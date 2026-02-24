import { Agent } from 'agents';
import type { Env } from '../types';

/**
 * TaskAgent — stub DO kept for Alchemy binding compatibility.
 * Will be replaced or removed when Container-based agent execution lands.
 */
export class TaskAgent extends Agent<Env, Record<string, never>> {
  async onRequest(request: Request): Promise<Response> {
    return new Response(JSON.stringify({ status: 'ok', agent: 'TaskAgent' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
