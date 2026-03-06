import type { D1Database, DurableObjectNamespace, R2Bucket } from '@cloudflare/workers-types';

/**
 * Cloudflare Worker environment bindings.
 */
export interface Env {
  // D1 Database (auth + session/node metadata)
  DB: D1Database;

  // Durable Object bindings
  ChatAgent: DurableObjectNamespace;
  SESSION_DO: DurableObjectNamespace;
  Sandbox: DurableObjectNamespace;
  ARTIFACTS: R2Bucket;

  // Environment variables
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  API_WS_HOST?: string;
  API_WS_ORIGIN?: string;
  OPENAI_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  OPENCODE_ZEN_API_KEY?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  MAILGUN_API_KEY?: string;
  MAILGUN_DOMAIN?: string;
}
