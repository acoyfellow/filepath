import type { D1Database } from '@cloudflare/workers-types';
import type { Sandbox } from '@cloudflare/sandbox';

/**
 * Cloudflare Worker environment bindings
 */
export interface Env {
  // D1 Database for user data
  DB: D1Database;
  
  // Container binding for sandboxes
  Sandbox: typeof Sandbox;
  
  // Environment variables
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  API_WS_HOST?: string;
  MAILGUN_API_KEY?: string;
  MAILGUN_DOMAIN?: string;
}
