import type { D1Database, DurableObjectNamespace } from '@cloudflare/workers-types';

/**
 * Cloudflare Worker environment bindings
 */
export interface Env {
  // D1 Database for user data
  DB: D1Database;
  
  // Container binding for sandboxes
  // Using any to avoid complex Sandbox type recursion
  Sandbox: DurableObjectNamespace<any>;
  
  // Environment variables
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  API_WS_HOST?: string;
  MAILGUN_API_KEY?: string;
  MAILGUN_DOMAIN?: string;
}
