import { betterAuth, type Auth } from 'better-auth';
import { sveltekitCookies } from "better-auth/svelte-kit";
import { apiKey } from 'better-auth/plugins';
import { passkey } from '@better-auth/passkey';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import { user, session, account, verification, apikey } from './schema';
import { getRequestEvent } from '$app/server';

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
  SESSION_DO?: any;
  WORKER?: any;
  DB?: any;
  [key: string]: any;
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
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
    },
    secret: env?.BETTER_AUTH_SECRET || (() => {
      throw new Error('BETTER_AUTH_SECRET environment variable is required');
    })(),
    baseURL,
    plugins: [
      sveltekitCookies(getRequestEvent as any),
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
        rpID: 'myfilepath.com',  // Your domain (or 'localhost' for dev)
        rpName: 'myfilepath',     // Human-readable name
      }),
    ],
  }) as unknown as Auth;

  return authInstance;
}

// Export for CLI schema generation
export const auth = betterAuth({
  database: drizzleAdapter(drizzle({} as any, {
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