/**
 * Worker entry point.
 *
 * Exports:
 * - ChatAgent DO (relay between frontend and sandbox)
 * - SessionEventBusV2 (session-scoped event bus)
 * - Sandbox (re-export for Container binding)
 *
 * Routes:
 * - /agents/* → Agent SDK (WebSocket connections to ChatAgent)
 * - session event routes for session-scoped websocket fan-out
 * - internal session event fan-out routes
 * - Everything else → 404
 */

import { routeAgentRequest } from 'agents';
import { proxyToSandbox } from '@cloudflare/sandbox';
import { ChatAgent } from '../src/agent/chat-agent';
import {
} from '../src/lib/agents/container';
import { SessionEventBusV2, Sandbox } from './index';
import type { Env } from '../src/types';

// Export DO classes (Alchemy needs these)
export { ChatAgent };
export { SessionEventBusV2 };
export { Sandbox };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const proxiedSandboxResponse = await proxyToSandbox(request as never, env as never);
    if (proxiedSandboxResponse) {
      return proxiedSandboxResponse;
    }

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

    const sessionEventsMatch = url.pathname.match(/^\/session-events\/([^/]+)$/);
    if (sessionEventsMatch) {
      const [, sessionId] = sessionEventsMatch;
      const sessionNamespace = env.SESSION_DO as any;
      const stub = sessionNamespace.get(sessionNamespace.idFromName(sessionId));
      return stub.fetch('https://session/connect', {
        method: 'GET',
        headers: request.headers,
      });
    }

    const internalSessionEventMatch = url.pathname.match(/^\/internal\/sessions\/([^/]+)\/events$/);
    if (internalSessionEventMatch && request.method === 'POST') {
      const [, sessionId] = internalSessionEventMatch;
      const sessionNamespace = env.SESSION_DO as any;
      const stub = sessionNamespace.get(sessionNamespace.idFromName(sessionId));
      return stub.fetch('https://session/events', {
        method: 'POST',
        headers: {
          'Content-Type': request.headers.get('content-type') || 'application/json',
        },
        body: request.body,
      });
    }

    return new Response('Not found', { status: 404 });
  },
};
