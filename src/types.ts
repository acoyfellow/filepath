import type { D1Database, DurableObjectNamespace } from '@cloudflare/workers-types';

// Workflow params types
export interface ExecuteTaskParams {
  userId: string;
  sessionId: string;
  task: string;
}

export interface CreateSessionParams {
  userId: string;
  sessionId: string;
}

/**
 * Cloudflare Worker environment bindings
 */
export interface Env {
  // D1 Database for user data
  DB: D1Database;
  
  // Container binding for sandboxes
  // Using any to avoid complex Sandbox type recursion
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Sandbox: DurableObjectNamespace<any>;
  
  // Workflow bindings for long-running tasks
  EXECUTE_TASK: Workflow<ExecuteTaskParams>;
  CREATE_SESSION: Workflow<CreateSessionParams>;
  
  // Environment variables
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  API_WS_HOST?: string;
  MAILGUN_API_KEY?: string;
  MAILGUN_DOMAIN?: string;
}
