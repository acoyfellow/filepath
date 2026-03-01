import { betterAuth, type Auth } from 'better-auth';
import { sveltekitCookies } from "better-auth/svelte-kit";
import { apiKey, mcp, multiSession, organization, admin, openAPI } from 'better-auth/plugins';
import { passkey } from '@better-auth/passkey';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import { user, session, account, verification, apikey } from './schema';
import { getRequestEvent } from '$app/server';
// Mailgun via native fetch (CF Workers compatible — no form-data/mailgun.js)

import type { D1Database, DurableObjectNamespace, Fetcher } from '@cloudflare/workers-types';

let authInstance: Auth | undefined = undefined;
let authBaseURL: string | null = null;
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

export function initAuth(db: D1Database, env: AuthEnv | undefined, baseURL: string): Auth {
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
      },
    });
  }

  if (authInstance !== undefined) {
    if (authBaseURL !== baseURL) {
      throw new Error(`Auth already initialized for ${authBaseURL}, cannot re-init for ${baseURL}`);
    }
    return authInstance;
  }

  authBaseURL = baseURL;
  authInstance = betterAuth({
    database: drizzleAdapter(drizzleInstance!, {
      provider: 'sqlite',
      schema: {
        user,
        session,
        account,
        verification,
        apikey,
        passkey,
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
    secret: env?.BETTER_AUTH_SECRET || (() => {
      throw new Error('BETTER_AUTH_SECRET environment variable is required');
    })(),
    baseURL,
    plugins: [
      sveltekitCookies(getRequestEvent),
      apiKey({
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
      passkey({
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
      mcp({
        loginPage: '/login',
        resource: 'myfilepath-mcp',
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
    ],
  }) as unknown as Auth;

  return authInstance;
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
      passkey,
    },
  }), { provider: 'sqlite' }),
  emailAndPassword: { enabled: true },
  secret: 'temp',
  baseURL: 'http://localhost:5173',
}) as unknown as Auth; 
