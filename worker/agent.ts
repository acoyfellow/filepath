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
  acceptAgentTask,
  approveAgentInterruption,
  cancelAgentTask,
  deleteAgentRuntime,
  getAgentRuntimeSnapshot,
  pauseAgentTask,
  processAcceptedAgentTask,
  rejectAgentInterruption,
  resumeAgentTask,
  runWorkspaceScript,
  scheduleAcceptedAgentTask,
  type RuntimeEnv,
} from '../src/lib/runtime/agent-runtime';
import {
  assertRuntimeBridgeCaller,
  assertTargetThreadInWorkspace,
  getThreadLastMessageForBridge,
  listWorkspaceThreadsForBridge,
} from '../src/lib/runtime/runtime-bridge';

function toRuntimeEnv(env: Env): RuntimeEnv {
  return {
    DB: env.DB,
    Sandbox: env.Sandbox as unknown as RuntimeEnv["Sandbox"],
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
    API_WS_HOST: env.API_WS_HOST,
    FILEPATH_RUNTIME_PUBLIC_BASE_URL: env.FILEPATH_RUNTIME_PUBLIC_BASE_URL,
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
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Filepath-Runtime-Token, X-Filepath-Request-Id, X-Filepath-Wait',
        },
      });
    }

    const threadsPath = url.pathname.match(/^\/runtime\/workspaces\/([^/]+)\/threads$/);
    if (threadsPath && request.method === "GET") {
      const workspaceId = threadsPath[1];
      try {
        const token = request.headers.get("x-filepath-runtime-token");
        await assertRuntimeBridgeCaller(runtimeEnv, token, workspaceId);
        const data = await listWorkspaceThreadsForBridge(runtimeEnv.DB, workspaceId);
        return new Response(JSON.stringify({ ok: true, ...data }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: error instanceof Error ? error.message : "Forbidden." }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    const lastMessagePath = url.pathname.match(
      /^\/runtime\/workspaces\/([^/]+)\/agents\/([^/]+)\/last-message$/,
    );
    if (lastMessagePath && request.method === "GET") {
      const [, workspaceId, targetAgentId] = lastMessagePath;
      try {
        const token = request.headers.get("x-filepath-runtime-token");
        await assertRuntimeBridgeCaller(runtimeEnv, token, workspaceId);
        const message = await getThreadLastMessageForBridge(
          runtimeEnv.DB,
          workspaceId,
          targetAgentId,
        );
        return new Response(JSON.stringify({ ok: true, message }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: error instanceof Error ? error.message : "Forbidden." }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        );
      }
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

      const taskMatch = suffix.match(/^\/agents\/([^/]+)\/tasks$/);
      if (request.method === "POST" && taskMatch) {
        const agentId = taskMatch[1];
        const bridgeToken = request.headers.get("x-filepath-runtime-token")?.trim() ?? null;
        if (bridgeToken) {
          try {
            await assertRuntimeBridgeCaller(runtimeEnv, bridgeToken, workspaceId);
            await assertTargetThreadInWorkspace(runtimeEnv.DB, agentId, workspaceId);
          } catch (error) {
            return new Response(
              JSON.stringify({ error: error instanceof Error ? error.message : "Forbidden." }),
              { status: 403, headers: { "Content-Type": "application/json" } },
            );
          }
        }
        const body = (await request.json().catch(() => ({}))) as {
          content?: string;
          identity?: {
            traceId?: string | null;
            proofRunId?: string | null;
            proofIterationId?: string | null;
          };
        };
        const content = typeof body.content === "string" ? body.content.trim() : "";
        const identity = body.identity;
        const requestId = request.headers.get("x-filepath-request-id") || crypto.randomUUID();
        if (!content) {
          return new Response(JSON.stringify({ error: "Task content is required." }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        const wait = request.headers.get("x-filepath-wait") === "true";
        try {
          const accepted = await acceptAgentTask(
            runtimeEnv,
            workspaceId,
            agentId,
            content,
            requestId,
            identity
              ? {
                  traceId: identity.traceId ?? undefined,
                  proofRunId: identity.proofRunId ?? undefined,
                  proofIterationId: identity.proofIterationId ?? undefined,
                }
              : undefined,
          );
          if (wait) {
            const { result, events } = await processAcceptedAgentTask(
              runtimeEnv,
              workspaceId,
              agentId,
              accepted.taskId,
              content,
              requestId,
            );
            return new Response(
              JSON.stringify({ ok: true, result, events, taskId: accepted.taskId }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          }
          scheduleAcceptedAgentTask(runtimeEnv, ctx, {
            workspaceId,
            agentId,
            taskId: accepted.taskId,
            content,
            requestId,
          });
          return new Response(JSON.stringify(accepted), {
            status: 202,
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
        const bridgeToken = request.headers.get("x-filepath-runtime-token")?.trim() ?? null;
        if (bridgeToken) {
          try {
            await assertRuntimeBridgeCaller(runtimeEnv, bridgeToken, workspaceId);
            await assertTargetThreadInWorkspace(runtimeEnv.DB, agentId, workspaceId);
          } catch (error) {
            return new Response(
              JSON.stringify({ error: error instanceof Error ? error.message : "Forbidden." }),
              { status: 403, headers: { "Content-Type": "application/json" } },
            );
          }
        }
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
