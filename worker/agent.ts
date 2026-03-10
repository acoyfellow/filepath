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

import { getAgentByName, routeAgentRequest } from 'agents';
import { proxyToSandbox } from '@cloudflare/sandbox';
import { ChatAgent, ChatNodeAgent } from '../src/agent/chat-agent';
import {
} from '../src/lib/agents/container';
import { SessionEventBusV2, Sandbox } from './index';
import type { Env } from '../src/types';

// Export DO classes (Alchemy needs these)
export { ChatAgent };
export { ChatNodeAgent };
export { SessionEventBusV2 };
export { Sandbox };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const isWebSocketRequest = request.headers.get("Upgrade")?.toLowerCase() === "websocket";

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
    const chatAgentMatch = url.pathname.match(/^\/agents\/chat-agent\/([^/]+)(?:\/health)?$/);
    if (chatAgentMatch) {
      const [, sessionId] = chatAgentMatch;
      const runtime = await getAgentByName(env.ChatAgent as never, sessionId);
      return runtime.fetch(request);
    }

    if (url.pathname.startsWith('/agents/')) {
      const response = await routeAgentRequest(request, env, {
        cors: true,
      });
      if (response) return response;

      if (isWebSocketRequest) {
        console.warn(`[worker] Agent websocket route returned no response for ${url.pathname}`);
      }
    }

    const sessionEventsMatch = url.pathname.match(/^\/session-events\/([^/]+)$/);
    if (sessionEventsMatch) {
      const [, sessionId] = sessionEventsMatch;
      const sessionNamespace = env.SESSION_DO as any;
      const stub = sessionNamespace.get(sessionNamespace.idFromName(sessionId));
      const connectRequest = new Request("https://session/connect", request);
      return stub.fetch(connectRequest);
    }

    const internalSessionEventMatch = url.pathname.match(/^\/internal\/sessions\/([^/]+)\/events$/);
    if (internalSessionEventMatch && request.method === 'POST') {
      const [, sessionId] = internalSessionEventMatch;
      const sessionNamespace = env.SESSION_DO as any;
      const stub = sessionNamespace.get(sessionNamespace.idFromName(sessionId));
      return stub.fetch(new Request('https://session/events', {
        method: 'POST',
        headers: {
          'Content-Type': request.headers.get('content-type') || 'application/json',
        },
        body: request.body,
      }));
    }

    const runtimeBootstrapMatch = url.pathname.match(/^\/internal\/runtime\/sessions\/([^/]+)\/nodes\/([^/]+)\/bootstrap$/);
    if (runtimeBootstrapMatch && request.method === "POST") {
      const [, sessionId, nodeId] = runtimeBootstrapMatch;
      const runtime = await getAgentByName(env.ChatAgent as never, sessionId);
      await (runtime as unknown as { ensureNodeRuntime: (id: string) => Promise<unknown> }).ensureNodeRuntime(nodeId);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const runtimeDeleteMatch = url.pathname.match(/^\/internal\/runtime\/sessions\/([^/]+)\/nodes\/([^/]+)$/);
    if (runtimeDeleteMatch && request.method === "DELETE") {
      const [, sessionId, nodeId] = runtimeDeleteMatch;
      const runtime = await getAgentByName(env.ChatAgent as never, sessionId);
      await (runtime as unknown as { deleteNodeRuntime: (id: string) => Promise<unknown> }).deleteNodeRuntime(nodeId);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const proxiedSandboxResponse = await proxyToSandbox(request as never, env as never);
    if (proxiedSandboxResponse) {
      return proxiedSandboxResponse;
    }

    return new Response('Not found', { status: 404 });
  },
};
