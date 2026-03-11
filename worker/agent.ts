/**
 * Worker entry point.
 *
 * Exports:
 * - Sandbox (re-export for Container binding)
 *
 * Routes:
 * - /runtime/* → internal workspace runtime bridge
 * - Everything else → 404
 */

import { proxyToSandbox } from '@cloudflare/sandbox';
import { Sandbox } from './index';
import type { Env } from '../src/types';
import {
  cancelAgentTask,
  deleteAgentRuntime,
  getAgentRuntimeSnapshot,
  type RuntimeEnv,
  runAgentTask,
} from '../src/lib/runtime/agent-runtime';

function toRuntimeEnv(env: Env): RuntimeEnv {
  return {
    DB: env.DB,
    Sandbox: env.Sandbox as unknown as RuntimeEnv["Sandbox"],
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
  };
}

export { Sandbox };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const runtimeEnv = toRuntimeEnv(env);

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

    const runtimeMatch = url.pathname.match(
      /^\/runtime\/workspaces\/([^/]+)(\/agents\/[^/]+(?:\/tasks|\/cancel)?|\/health)?$/,
    );
    if (runtimeMatch) {
      const [, workspaceId, suffix = ""] = runtimeMatch;
      if (request.method === "GET" && suffix === "/health") {
        return new Response(JSON.stringify({ ok: true, workspaceId }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      const taskMatch = suffix.match(/^\/agents\/([^/]+)\/tasks$/);
      if (request.method === "POST" && taskMatch) {
        const agentId = taskMatch[1];
        const body = (await request.json().catch(() => ({}))) as { content?: string };
        const content = body.content?.trim();
        if (!content) {
          return new Response(JSON.stringify({ error: "Task content is required." }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const result = await runAgentTask(runtimeEnv, workspaceId, agentId, content);
          return new Response(JSON.stringify({ ok: true, result }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          return new Response(
            JSON.stringify({
              error: error instanceof Error ? error.message : "Unable to run agent task.",
            }),
            { status: 409, headers: { "Content-Type": "application/json" } },
          );
        }
      }

      const cancelMatch = suffix.match(/^\/agents\/([^/]+)\/cancel$/);
      if (request.method === "POST" && cancelMatch) {
        const agentId = cancelMatch[1];
        const cancelled = await cancelAgentTask(runtimeEnv, agentId);
        return new Response(JSON.stringify({ ok: true, cancelled }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      const agentMatch = suffix.match(/^\/agents\/([^/]+)$/);
      if (request.method === "GET" && agentMatch) {
        const agentId = agentMatch[1];
        try {
          const runtime = await getAgentRuntimeSnapshot(runtimeEnv, workspaceId, agentId);
          return new Response(JSON.stringify({ ok: true, runtime }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          return new Response(
            JSON.stringify({
              error: error instanceof Error ? error.message : "Unable to load agent runtime.",
            }),
            { status: 404, headers: { "Content-Type": "application/json" } },
          );
        }
      }

      if (request.method === "DELETE" && agentMatch) {
        const agentId = agentMatch[1];
        await deleteAgentRuntime(runtimeEnv, agentId);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
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
