import type { RequestEvent } from "@sveltejs/kit";
import type { RuntimeEnv } from "$lib/runtime/agent-runtime";

type RuntimeEvent = Pick<RequestEvent, "url" | "platform">;

type RuntimeIdentityInput = {
  traceId: string | null;
  proofRunId: string | null;
  proofIterationId: string | null;
};

function getLocalRuntimeEnv(event: RuntimeEvent) {
  const env = event.platform?.env;
  if (!env?.DB) return null;
  const extraEnv = env as Record<string, unknown>;
  return {
    DB: env.DB,
    Sandbox: env.Sandbox as unknown as RuntimeEnv["Sandbox"],
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
    DEJA_ENDPOINT: typeof extraEnv.DEJA_ENDPOINT === "string" ? extraEnv.DEJA_ENDPOINT : undefined,
    DEJA_API_KEY: typeof extraEnv.DEJA_API_KEY === "string" ? extraEnv.DEJA_API_KEY : undefined,
  };
}

async function readJsonBody(init?: RequestInit): Promise<Record<string, unknown>> {
  if (!init?.body) return {};
  if (typeof init.body === "string") {
    return JSON.parse(init.body) as Record<string, unknown>;
  }
  return {};
}

function parseRuntimeIdentity(value: unknown): RuntimeIdentityInput | undefined {
  if (!value || typeof value !== "object") return undefined;
  const identity = value as Record<string, unknown>;
  return {
    traceId: typeof identity.traceId === "string" ? identity.traceId : null,
    proofRunId: typeof identity.proofRunId === "string" ? identity.proofRunId : null,
    proofIterationId:
      typeof identity.proofIterationId === "string" ? identity.proofIterationId : null,
  };
}

async function dispatchLocalRuntime(
  event: RuntimeEvent,
  normalizedPath: string,
  init?: RequestInit,
): Promise<Response | null> {
  const runtimeEnv = getLocalRuntimeEnv(event);
  if (!runtimeEnv) return null;

  const runtime = await import("$lib/runtime/agent-runtime");
  const [pathname, search] = normalizedPath.split("?", 2);
  const searchParams = search ? new URLSearchParams(search) : new URLSearchParams();
  const match = pathname.match(
    /^\/runtime\/workspaces\/([^/]+)(\/agents\/[^/]+(?:\/tasks|\/cancel|\/pause|\/resume|\/approve|\/reject)?|\/run\/script|\/health)?$/,
  );
  if (!match) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [, workspaceId, suffix = ""] = match;

  if ((init?.method ?? "GET") === "GET" && suffix === "/health") {
    return new Response(JSON.stringify({ ok: true, workspaceId }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if ((init?.method ?? "GET") === "POST" && suffix === "/run/script") {
    const body = await readJsonBody(init) as {
      script?: string;
      scope?: {
        allowedPaths?: unknown;
        forbiddenPaths?: unknown;
        toolPermissions?: unknown;
        writableRoot?: unknown;
      };
    };
    const script = typeof body.script === "string" ? body.script : "";
    const sc = body.scope;
    const scopeInput =
      sc && typeof sc === "object"
        ? {
            allowedPaths: Array.isArray(sc.allowedPaths) ? sc.allowedPaths : undefined,
            forbiddenPaths: Array.isArray(sc.forbiddenPaths) ? sc.forbiddenPaths : undefined,
            toolPermissions: Array.isArray(sc.toolPermissions) ? sc.toolPermissions : undefined,
            writableRoot:
              sc.writableRoot !== undefined
                ? (sc.writableRoot as string | null)
                : undefined,
          }
        : undefined;
    try {
      const result = await runtime.runWorkspaceScript(
        runtimeEnv,
        workspaceId,
        script,
        scopeInput,
      );
      return new Response(
        JSON.stringify({ ok: true, result }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
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

  const taskMatch = suffix.match(/^\/agents\/([^/]+)\/tasks$/);
  if ((init?.method ?? "GET") === "POST" && taskMatch) {
    const agentId = taskMatch[1];
    const body = await readJsonBody(init);
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const identity = parseRuntimeIdentity(body.identity);
    const requestId =
      init?.headers instanceof Headers
        ? init.headers.get("x-filepath-request-id") || crypto.randomUUID()
        : crypto.randomUUID();
    if (!content) {
      return new Response(JSON.stringify({ error: "Task content is required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const wait =
      searchParams.get("wait") === "1" ||
      (init?.headers instanceof Headers && init.headers.get("x-filepath-wait") === "true");

    try {
      const accepted = await runtime.acceptAgentTask(runtimeEnv, workspaceId, agentId, content, requestId, identity);
      if (wait) {
        const { result, events } = await runtime.processAcceptedAgentTask(
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
      runtime.scheduleAcceptedAgentTask(runtimeEnv, null, {
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
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  const cancelMatch = suffix.match(/^\/agents\/([^/]+)\/cancel$/);
  if ((init?.method ?? "GET") === "POST" && cancelMatch) {
    const agentId = cancelMatch[1];
    const cancelled = await runtime.cancelAgentTask(runtimeEnv, workspaceId, agentId);
    return new Response(JSON.stringify({ ok: true, ...cancelled }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const pauseMatch = suffix.match(/^\/agents\/([^/]+)\/pause$/);
  if ((init?.method ?? "GET") === "POST" && pauseMatch) {
    const agentId = pauseMatch[1];
    const paused = await runtime.pauseAgentTask(runtimeEnv, workspaceId, agentId);
    return new Response(JSON.stringify({ ok: true, ...paused }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const resumeMatch = suffix.match(/^\/agents\/([^/]+)\/resume$/);
  if ((init?.method ?? "GET") === "POST" && resumeMatch) {
    const agentId = resumeMatch[1];
    const resumed = await runtime.resumeAgentTask(runtimeEnv, workspaceId, agentId);
    if (resumed.resumed && resumed.taskId && resumed.content) {
      runtime.scheduleAcceptedAgentTask(runtimeEnv, null, {
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
  if ((init?.method ?? "GET") === "POST" && approveMatch) {
    const agentId = approveMatch[1];
    const approved = await runtime.approveAgentInterruption(runtimeEnv, workspaceId, agentId);
    if (approved.approved && approved.taskId && approved.content) {
      runtime.scheduleAcceptedAgentTask(runtimeEnv, null, {
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
  if ((init?.method ?? "GET") === "POST" && rejectMatch) {
    const agentId = rejectMatch[1];
    const rejected = await runtime.rejectAgentInterruption(runtimeEnv, agentId);
    return new Response(JSON.stringify({ ok: true, ...rejected }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const agentMatch = suffix.match(/^\/agents\/([^/]+)$/);
  if ((init?.method ?? "GET") === "GET" && agentMatch) {
    const agentId = agentMatch[1];
    try {
      const snapshot = await runtime.getAgentRuntimeSnapshot(runtimeEnv, workspaceId, agentId);
      return new Response(JSON.stringify({ ok: true, runtime: snapshot }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Unable to load agent runtime.",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  if ((init?.method ?? "GET") === "DELETE" && agentMatch) {
    const agentId = agentMatch[1];
    await runtime.deleteAgentRuntime(runtimeEnv, agentId);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

export function resolveRuntimeBaseUrl(event: RuntimeEvent): string {
  const hostname = event.url.hostname;
  const apiWsOrigin = event.platform?.env?.API_WS_ORIGIN;
  const apiWsHost = event.platform?.env?.API_WS_HOST;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:1337";
  }

  if (apiWsOrigin) {
    return apiWsOrigin;
  }

  if (apiWsHost) {
    return `https://${apiWsHost}`;
  }

  if (hostname === "myfilepath.com") {
    return "https://api.myfilepath.com";
  }

  return event.url.origin;
}

export async function fetchRuntime(
  event: RuntimeEvent,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const isLocalhost = event.url.hostname === "localhost" || event.url.hostname === "127.0.0.1";
  const service = event.platform?.env?.WORKER;

  if (isLocalhost) {
    const localResponse = await dispatchLocalRuntime(event, normalizedPath, init);
    if (localResponse) {
      return localResponse;
    }
  }

  if (service) {
    return service.fetch(`http://worker${normalizedPath}`, init);
  }

  const localResponse = await dispatchLocalRuntime(event, normalizedPath, init);
  if (localResponse) {
    return localResponse;
  }

  return fetch(`${resolveRuntimeBaseUrl(event)}${normalizedPath}`, init);
}
