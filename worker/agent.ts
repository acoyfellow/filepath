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
import { getSandbox, proxyToSandbox } from '@cloudflare/sandbox';
import { ChatAgent } from '../src/agent/chat-agent';
import { TaskAgent } from '../src/agent/index';
import { ensureTerminalInContainer } from '../src/lib/agents/container';
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

    const terminalMatch = url.pathname.match(
      /^\/terminal\/session\/([^/]+)\/node\/([^/]+)(?:\/(meta))?$/,
    );
    if (terminalMatch) {
      const [, sessionId, nodeId, metaRoute] = terminalMatch;
      const nodeRow = await env.DB.prepare(
        `SELECT container_id as containerId FROM agent_node WHERE id = ? AND session_id = ?`,
      )
        .bind(nodeId, sessionId)
        .first<{ containerId: string | null }>();

      if (!nodeRow) {
        return new Response('Thread not found', { status: 404 });
      }
      if (!nodeRow.containerId) {
        return new Response(
          JSON.stringify({ message: 'This thread has no live sandbox runtime yet.' }),
          {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      try {
        const host = request.headers.get('host') ?? url.host;
        const terminal = await ensureTerminalInContainer(
          { Sandbox: env.Sandbox as never },
          nodeRow.containerId,
          host,
        );
        if (metaRoute === 'meta') {
          return new Response(JSON.stringify({ ok: true, url: terminal.url }), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }

        return Response.redirect(terminal.url, 302);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Terminal is unavailable for this thread.';
        return new Response(JSON.stringify({ message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const processMatch = url.pathname.match(
      /^\/internal\/sessions\/([^/]+)\/nodes\/([^/]+)\/processes$/,
    );
    if (processMatch) {
      const [, sessionId, nodeId] = processMatch;
      const nodeRow = await env.DB.prepare(
        `SELECT container_id as containerId, name FROM agent_node WHERE id = ? AND session_id = ?`,
      )
        .bind(nodeId, sessionId)
        .first<{ containerId: string | null; name: string }>();

      if (!nodeRow) {
        return new Response('Thread not found', { status: 404 });
      }
      if (!nodeRow.containerId) {
        return new Response(JSON.stringify({ processes: [] }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const sandbox = getSandbox(env.Sandbox as never, nodeRow.containerId) as {
        listProcesses(): Promise<Array<{ id: string; command: string; status: string }>>;
      };

      const processes = await sandbox.listProcesses();
      const mappedProcesses = processes.map((process) => {
        const command = process.command.toLowerCase();
        const kind =
          command.includes('ttyd')
            ? 'terminal'
            : command.includes('bash') || command.includes('sh ')
              ? 'shell'
              : command.includes('codex') ||
                  command.includes('claude') ||
                  command.includes('cursor') ||
                  command.includes('amp') ||
                  command.includes('shelley') ||
                  command.includes('pi')
                ? 'agent'
                : command.includes('node') ||
                    command.includes('python') ||
                    command.includes('npm')
                  ? 'helper'
                  : 'unknown';
        const status =
          process.status === 'running'
            ? 'running'
            : process.status === 'starting' || process.status === 'pending'
              ? 'starting'
              : 'exited';

        return {
          id: process.id,
          name: process.command.split(' ').slice(0, 3).join(' ') || nodeRow.name,
          kind,
          status,
        };
      });

      return new Response(JSON.stringify({ processes: mappedProcesses }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new Response('Not found', { status: 404 });
  },
};
