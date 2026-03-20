/**
 * Worker entry point.
 *
 * Exports:
 * - Sandbox (re-export for Container binding)
 * - ConversationAgent (Durable Object for agent task execution)
 *
 * Routes:
 * - /agents/* → routeAgentRequest (ConversationAgent DO)
 * - /runtime/* → internal workspace runtime bridge
 * - Everything else → 404
 */

import { routeAgentRequest } from "agents";
import { proxyToSandbox } from "@cloudflare/sandbox";
export { Sandbox } from "@cloudflare/sandbox";
export { ConversationAgent } from "./conversation-agent";
import type { Env } from '../src/types';
import {
  approveAgentInterruption,
  cancelAgentTask,
  deleteAgentRuntime,
  getAgentRuntimeSnapshot,
  pauseAgentTask,
  rejectAgentInterruption,
  resumeAgentTask,
  runWorkspaceScript,
  scheduleAcceptedAgentTask,
  type RuntimeEnv,
} from '../src/lib/runtime/agent-runtime';

function toRuntimeEnv(env: Env): RuntimeEnv {
  return {
    DB: env.DB,
    Sandbox: env.Sandbox as unknown as RuntimeEnv["Sandbox"],
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    const agentResponse = await routeAgentRequest(request, env as Parameters<typeof routeAgentRequest>[1], { cors: true });
    if (agentResponse) {
      return agentResponse;
    }

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
      /^\/runtime\/workspaces\/([^/]+)(\/agents\/[^/]+(?:\/tasks|\/cancel|\/pause|\/resume|\/approve|\/reject)?|\/run\/script|\/health)?$/,
    );
    if (runtimeMatch) {
      const [, workspaceId, suffix = ""] = runtimeMatch;
      if (request.method === "POST" && suffix === "/run/script") {
        const body = (await request.json().catch(() => ({}))) as {
          script?: string;
          scope?: {
            allowedPaths?: string[];
            forbiddenPaths?: string[];
            toolPermissions?: string[];
            writableRoot?: string | null;
          };
        };
        const script = typeof body.script === "string" ? body.script : "";
        const scopeInput = body.scope;
        try {
          const result = await runWorkspaceScript(
            runtimeEnv,
            workspaceId,
            script,
            scopeInput,
          );
          return new Response(JSON.stringify({ ok: true, result }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          return new Response(
            JSON.stringify({
              error: error instanceof Error ? error.message : "Script run failed.",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      }
      if (request.method === "GET" && suffix === "/health") {
        return new Response(JSON.stringify({ ok: true, workspaceId }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // POST /agents/:id/tasks removed - use ConversationAgent DO runTask via WebSocket

      const cancelMatch = suffix.match(/^\/agents\/([^/]+)\/cancel$/);
      if (request.method === "POST" && cancelMatch) {
        const agentId = cancelMatch[1];
        const cancelled = await cancelAgentTask(runtimeEnv, workspaceId, agentId);
        return new Response(JSON.stringify({ ok: true, ...cancelled }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      const pauseMatch = suffix.match(/^\/agents\/([^/]+)\/pause$/);
      if (request.method === "POST" && pauseMatch) {
        const agentId = pauseMatch[1];
        const paused = await pauseAgentTask(runtimeEnv, workspaceId, agentId);
        return new Response(JSON.stringify({ ok: true, ...paused }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      const resumeMatch = suffix.match(/^\/agents\/([^/]+)\/resume$/);
      if (request.method === "POST" && resumeMatch) {
        const agentId = resumeMatch[1];
        const resumed = await resumeAgentTask(runtimeEnv, workspaceId, agentId);
        if (resumed.resumed && resumed.taskId && resumed.content) {
          scheduleAcceptedAgentTask(runtimeEnv, ctx, {
            workspaceId,
            agentId,
            taskId: resumed.taskId,
            content: resumed.content,
            requestId: resumed.traceId ?? crypto.randomUUID(),
          });
        }
        return new Response(JSON.stringify({ ok: true, ...resumed }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      const approveMatch = suffix.match(/^\/agents\/([^/]+)\/approve$/);
      if (request.method === "POST" && approveMatch) {
        const agentId = approveMatch[1];
        const approved = await approveAgentInterruption(runtimeEnv, workspaceId, agentId);
        if (approved.approved && approved.taskId && approved.content) {
          scheduleAcceptedAgentTask(runtimeEnv, ctx, {
            workspaceId,
            agentId,
            taskId: approved.taskId,
            content: approved.content,
            requestId: approved.traceId ?? crypto.randomUUID(),
          });
        }
        return new Response(JSON.stringify({ ok: true, ...approved }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      const rejectMatch = suffix.match(/^\/agents\/([^/]+)\/reject$/);
      if (request.method === "POST" && rejectMatch) {
        const agentId = rejectMatch[1];
        const rejected = await rejectAgentInterruption(runtimeEnv, agentId);
        return new Response(JSON.stringify({ ok: true, ...rejected }), {
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
