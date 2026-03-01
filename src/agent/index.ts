import { Agent } from 'agents';
import type { Env } from '../types';

/**
 * TaskAgent — compatibility DO kept for Alchemy binding compatibility.
 * Will be replaced or removed when Container-based agent execution lands.
 */
export class TaskAgent extends Agent<Env, Record<string, never>> {
  async onRequest(_request: Request): Promise<Response> {
    return new Response(JSON.stringify({ error: 'TaskAgent is not implemented' }), {
      status: 501,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
