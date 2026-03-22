import type { D1Database, DurableObjectNamespace } from '@cloudflare/workers-types';

/**
 * Cloudflare Worker environment bindings.
 */
export interface Env {
  // D1 Database (auth + workspace/agent metadata)
  DB: D1Database;

  // Durable Object bindings
  Sandbox: DurableObjectNamespace;
  ConversationAgent?: DurableObjectNamespace;

  // Environment variables
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  API_WS_HOST?: string;
  /** Public base URL for sandbox → worker runtime bridge (e.g. https://api.myfilepath.com) */
  FILEPATH_RUNTIME_PUBLIC_BASE_URL?: string;
  OPENAI_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  OPENCODE_ZEN_API_KEY?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  MAILGUN_API_KEY?: string;
  MAILGUN_DOMAIN?: string;
}
