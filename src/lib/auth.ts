import { betterAuth, type Auth } from 'better-auth';
import { sveltekitCookies } from "better-auth/svelte-kit";
import { multiSession, organization, admin, openAPI } from 'better-auth/plugins';
import { apiKey } from '@better-auth/api-key';
import { passkey as passkeyPlugin } from '@better-auth/passkey';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import { user, session, account, verification, apikey, passkey as passkeyTable } from './schema';
import { eq } from 'drizzle-orm';
import { resolveBetterAuthSecret } from './better-auth-secret';
// Mailgun via native fetch (CF Workers compatible — no form-data/mailgun.js)

import type { D1Database } from '@cloudflare/workers-types';

const authInstances = new Map<string, Auth>();
let drizzleInstance: ReturnType<typeof drizzle> | null = null;

export function getDrizzle(): ReturnType<typeof drizzle> {
  if (!drizzleInstance) {
    throw new Error('Database not initialized. Call initAuth() first.');
  }
  return drizzleInstance;
}

interface AuthEnv {
  BETTER_AUTH_SECRET?: string;
  MAILGUN_API_KEY?: string;
  MAILGUN_DOMAIN?: string;
  [key: string]: unknown;
}

type SvelteKitRequestEventGetter = Parameters<typeof sveltekitCookies>[0];

export interface ResolvedAuthUser {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  email: string;
  emailVerified: boolean;
  name: string;
  image?: string | null;
  role?: string | null;
}

export interface ResolvedRequestAuth {
  user: ResolvedAuthUser | null;
  session: unknown | null;
}

function getApiKeyFromHeaders(headers: Headers): string | null {
  const direct = headers.get('x-api-key');
  if (direct?.trim()) {
    return direct.trim();
  }

  const authorization = headers.get('authorization');
  if (!authorization) {
    return null;
  }

  if (authorization.startsWith('Bearer ')) {
    const token = authorization.slice('Bearer '.length).trim();
    return token || null;
  }

  return authorization.trim() || null;
}

export function initAuth(
  db: D1Database,
  env: AuthEnv | undefined,
  baseURL: string,
  options?: {
    getRequestEvent?: SvelteKitRequestEventGetter;
  },
): Auth {
  if (!db) {
    throw new Error('D1 database is required for Better Auth');
  }

  if (!baseURL) {
    throw new Error("baseURL is required for Better Auth");
  }

  // Create singleton Drizzle instance (connection pooling)
  if (!drizzleInstance) {
    drizzleInstance = drizzle(db, {
      schema: {
        user,
        session,
        account,
        verification,
        apikey,
        passkey: passkeyTable,
      },
    });
  }

  const authKey = `${baseURL}::${options?.getRequestEvent ? "sveltekit" : "core"}`;
  const existingAuth = authInstances.get(authKey);
  if (existingAuth) {
    return existingAuth;
  }

  const plugins = [
    ...(options?.getRequestEvent ? [sveltekitCookies(options.getRequestEvent)] : []),
    apiKey({
      configId: 'default',
      references: 'user',
      // Prefix for agent API keys
      apiKeyHeaders: ['x-api-key', 'authorization'],
      // Enable metadata for storing agent name, owner info
      enableMetadata: true,
      // Rate limiting per API key
      rateLimit: {
        enabled: true,
        timeWindow: 1000 * 60 * 60, // 1 hour
        maxRequests: 1000,
      },
    }),
    passkeyPlugin({
      rpID: baseURL.includes('localhost') ? 'localhost' : 'myfilepath.com',
      rpName: 'myfilepath',
      origin: baseURL,
    }),
    emailOTP({
      sendVerificationOTP: async ({ email, otp, type }) => {
        const mgKey = env?.MAILGUN_API_KEY || process.env.MAILGUN_API_KEY || '';
        const domain = env?.MAILGUN_DOMAIN || process.env.MAILGUN_DOMAIN || '';

        const sendMail = async (subject: string, text: string, html: string) => {
          const form = new FormData();
          form.append('from', `Filepath <support@${domain}>`);
          form.append('to', email);
          form.append('subject', subject);
          form.append('text', text);
          form.append('html', html);

          const resp = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
            method: 'POST',
            headers: { Authorization: `Basic ${btoa(`api:${mgKey}`)}` },
            body: form,
          });
          if (!resp.ok) {
            const body = await resp.text();
            throw new Error(`Mailgun ${resp.status}: ${body}`);
          }
        };

        try {
          if (type === 'forget-password') {
            await sendMail(
              'Password Reset Request',
              `You requested to reset your password. Use this code: ${otp}`,
              `<p>You requested to reset your password. Use this code: <strong>${otp}</strong></p>`,
            );
          } else if (type === 'email-verification') {
            await sendMail(
              'Welcome to Filepath!',
              `Welcome to Filepath! Your verification code is: ${otp}\n\nFilepath is the platform for agents.`,
              `<h1>Welcome to Filepath!</h1><p>Your verification code is: <strong>${otp}</strong></p><p>Filepath is the platform for agents.</p>`,
            );
          }
        } catch (error) {
          console.error('Error sending email:', error);
          throw error;
        }
      },
      otpLength: 6,
      expiresIn: 60 * 10, // 10 minutes
      sendVerificationOnSignUp: true, // Send welcome email on sign-up
    }),
    multiSession({
      maximumSessions: 5,
    }),
    organization({
      // Organization plugin configuration
    }),
    admin({
      // Admin plugin configuration
      adminRoles: ['admin'],
      defaultRole: 'user',
    }),
    openAPI({
      path: '/api/auth/reference',
      playground: {
        enabled: true
      },
    }),
  ];

  const authInstance = betterAuth({
    database: drizzleAdapter(drizzleInstance!, {
      provider: 'sqlite',
      schema: {
        user,
        session,
        account,
        verification,
        apikey,
        passkey: passkeyTable,
      },
    }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      requireEmailVerification: false,
    },
    user: {
      deleteUser: {
        enabled: true,
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
    },
    secret: resolveBetterAuthSecret({
      envSecret: env?.BETTER_AUTH_SECRET,
      baseURL,
    }) || (() => {
      throw new Error('BETTER_AUTH_SECRET environment variable is required');
    })(),
    baseURL,
    plugins,
  }) as unknown as Auth;

  authInstances.set(authKey, authInstance);
  return authInstance;
}

export async function resolveRequestAuth(options: {
  db: D1Database;
  env: AuthEnv | undefined;
  baseURL: string;
  headers: Headers;
  apiKeyOverride?: string | null;
}): Promise<ResolvedRequestAuth> {
  const auth = initAuth(options.db, options.env, options.baseURL);

  const session = await auth.api.getSession({
    headers: options.headers,
  });
  if (session?.user) {
    return {
      user: {
        id: session.user.id,
        createdAt: session.user.createdAt,
        updatedAt: session.user.updatedAt,
        email: session.user.email,
        emailVerified: session.user.emailVerified,
        name: session.user.name,
        image: session.user.image,
        role: (session.user as { role?: string | null }).role ?? null,
      },
      session: session.session,
    };
  }

  const apiKey = options.apiKeyOverride ?? getApiKeyFromHeaders(options.headers);
  if (!apiKey) {
    return { user: null, session: null };
  }

  const verification = await (auth.api as unknown as {
    verifyApiKey(input: { body: { key: string } }): Promise<{
      valid: boolean;
      key: { referenceId?: string | null } | null;
    }>;
  }).verifyApiKey({
    body: { key: apiKey },
  });

  if (!verification.valid || !verification.key?.referenceId) {
    return { user: null, session: null };
  }

  const dbHandle = getDrizzle();
  const rows = await dbHandle
    .select()
    .from(user)
    .where(eq(user.id, verification.key.referenceId))
    .limit(1);

  const apiUser = rows[0];
  if (!apiUser) {
    return { user: null, session: null };
  }

  return {
    user: {
      id: apiUser.id,
      createdAt: apiUser.createdAt,
      updatedAt: apiUser.updatedAt,
      email: apiUser.email,
      emailVerified: apiUser.emailVerified,
      name: apiUser.name ?? apiUser.email,
      image: apiUser.image ?? undefined,
      role: apiUser.role,
    },
    session: null,
  };
}

// Export for CLI schema generation
// Minimal D1-shaped adapter used only for schema generation, never at runtime.
const schemaD1Database = {
  prepare: () => ({
    bind: () => ({}),
    first: async () => null,
    run: async () => ({ success: true, meta: {} }),
    all: async () => ({ results: [], success: true, meta: {} }),
    raw: async () => [],
  }),
  batch: async () => [],
  exec: async () => ({ count: 0, duration: 0 }),
  withSession: () => schemaD1Database,
  dump: async () => new ArrayBuffer(0),
} as unknown as D1Database;

export const auth = betterAuth({
  database: drizzleAdapter(drizzle(schemaD1Database, {
    schema: {
      user,
      session,
      account,
      verification,
      apikey,
      passkey: passkeyTable,
    },
  }), { provider: 'sqlite' }),
  emailAndPassword: { enabled: true },
  plugins: [
    apiKey({
      configId: 'default',
      references: 'user',
      apiKeyHeaders: ['x-api-key', 'authorization'],
      enableMetadata: true,
    }),
    passkeyPlugin(),
    emailOTP({
      sendVerificationOTP: async () => {},
    }),
  ],
  secret: 'temp',
  baseURL: 'http://localhost:5173',
}) as unknown as Auth; 
