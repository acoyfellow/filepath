import { betterAuth, type Auth } from 'better-auth';
import { sveltekitCookies } from "better-auth/svelte-kit";
import { multiSession, organization, admin, openAPI } from 'better-auth/plugins';
import { apiKey } from '@better-auth/api-key';
import { passkey as passkeyPlugin } from '@better-auth/passkey';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import { user, session, account, verification, apikey, passkey as passkeyTable } from './schema';
import { and, eq, gt } from 'drizzle-orm';
import { resolveBetterAuthSecret } from './better-auth-secret';
import { parse as parseCookie } from 'cookie';

import type { D1Database } from '@cloudflare/workers-types';

/** Cloudflare Email Sending binding — minimal shape we consume. */
interface CloudflareEmailSender {
  send(opts: {
    to: string | string[];
    from: string | { email: string; name?: string };
    subject: string;
    text?: string;
    html?: string;
  }): Promise<{ messageId: string }>;
}

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
  /** Cloudflare Email Sending binding — configured via alchemy `EmailSender()`. */
  EMAIL?: CloudflareEmailSender;
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

function getSessionTokenFromHeaders(headers: Headers): string | null {
  const rawCookie = headers.get('cookie');
  if (!rawCookie) {
    return null;
  }

  const cookies = parseCookie(rawCookie);
  const rawToken = cookies['better-auth.session_token'];
  if (!rawToken) {
    return null;
  }

  const token = rawToken.split('.', 1)[0]?.trim();
  return token || null;
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
        const emailBinding = env?.EMAIL;
        const isLocal =
          baseURL.includes("localhost") ||
          baseURL.includes("127.0.0.1") ||
          !emailBinding;

        if (isLocal) {
          // Local dev: log the OTP; no real delivery.
          console.log(`[better-auth] local dev OTP for ${email} (${type}): ${otp}`);
          return;
        }

        const [subject, text, html] =
          type === "forget-password"
            ? [
                "Password reset for your filepath account",
                `You requested to reset your password. Use this code: ${otp}\n\nIf you did not request this, you can ignore this email.`,
                `<p>You requested to reset your password. Use this code: <strong>${otp}</strong></p><p>If you did not request this, you can ignore this email.</p>`,
              ]
            : [
                "Welcome to filepath",
                `Welcome to filepath! Your verification code is: ${otp}`,
                `<h1>Welcome to filepath</h1><p>Your verification code is: <strong>${otp}</strong></p>`,
              ];

        try {
          await emailBinding.send({
            to: email,
            from: { email: "noreply@myfilepath.com", name: "filepath" },
            subject,
            text,
            html,
          });
        } catch (error) {
          console.error("[better-auth] Cloudflare Email send failed:", error);
          throw error;
        }
      },
      otpLength: 6,
      expiresIn: 60 * 10, // 10 minutes
      sendVerificationOnSignUp: true,
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

  const resolvedSession = await auth.api.getSession({
    headers: options.headers,
  });
  if (resolvedSession?.user) {
    return {
      user: {
        id: resolvedSession.user.id,
        createdAt: resolvedSession.user.createdAt,
        updatedAt: resolvedSession.user.updatedAt,
        email: resolvedSession.user.email,
        emailVerified: resolvedSession.user.emailVerified,
        name: resolvedSession.user.name,
        image: resolvedSession.user.image,
        role: (resolvedSession.user as { role?: string | null }).role ?? null,
      },
      session: resolvedSession.session,
    };
  }

  const sessionToken = getSessionTokenFromHeaders(options.headers);
  if (sessionToken) {
    const dbHandle = getDrizzle();
    const rows = await dbHandle
      .select({
        sessionId: session.id,
        expiresAt: session.expiresAt,
        token: session.token,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        userId: session.userId,
        user: user,
      })
      .from(session)
      .innerJoin(user, eq(session.userId, user.id))
      .where(and(eq(session.token, sessionToken), gt(session.expiresAt, new Date())))
      .limit(1);

    const resolved = rows[0];
    if (resolved) {
      return {
        user: {
          id: resolved.user.id,
          createdAt: resolved.user.createdAt,
          updatedAt: resolved.user.updatedAt,
          email: resolved.user.email,
          emailVerified: resolved.user.emailVerified,
          name: resolved.user.name ?? resolved.user.email,
          image: resolved.user.image ?? undefined,
          role: resolved.user.role ?? null,
        },
        session: {
          id: resolved.sessionId,
          token: resolved.token,
          expiresAt: resolved.expiresAt,
          createdAt: resolved.createdAt,
          updatedAt: resolved.updatedAt,
          ipAddress: resolved.ipAddress,
          userAgent: resolved.userAgent,
          userId: resolved.userId,
        },
      };
    }
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
