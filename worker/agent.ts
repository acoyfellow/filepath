/**
 * Worker entry point.
 *
 * Exports:
 * - ChatAgent DO (chat + LLM, SQLite persistence)
 * - TaskAgent DO (compatibility binding that fails closed)
 * - SessionDO (compatibility binding that fails closed)
 * - Sandbox (re-export for Container binding)
 *
 * Routes:
 * - /agents/* → Agent SDK (WebSocket connections to ChatAgent)
 * - Everything else → 404
 */

import { routeAgentRequest } from 'agents';
import { ChatAgent } from '../src/agent/chat-agent';
import { TaskAgent } from '../src/agent/index';
import { SessionDO, Sandbox } from './index';
import type { Env } from '../src/types';

// Export DO classes (Alchemy needs these)
export { ChatAgent };
export { TaskAgent };
export { SessionDO };
export { Sandbox };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // /agents/* → Agent SDK handles WebSocket upgrade + routing
    if (url.pathname.startsWith('/agents/')) {
      const response = await routeAgentRequest(request, env, {
        cors: true,
      });
      if (response) return response;
    }

    // /api/config → return worker URL for frontend WebSocket connections
    if (url.pathname === '/api/config') {
      const workerUrl = env.API_WS_HOST
        ? `https://${env.API_WS_HOST}`
        : url.origin;
      return new Response(JSON.stringify({ workerUrl }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new Response('Not found', { status: 404 });
  },
};
