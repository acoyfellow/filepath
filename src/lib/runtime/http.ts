import type { RequestEvent } from "@sveltejs/kit";
import type { RuntimeEnv } from "$lib/runtime/agent-runtime";

type RuntimeEvent = Pick<RequestEvent, "url" | "platform">;

function getLocalRuntimeEnv(event: RuntimeEvent) {
  const env = event.platform?.env;
  if (!env?.DB) return null;
  return {
    DB: env.DB,
    Sandbox: env.Sandbox as unknown as RuntimeEnv["Sandbox"],
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
  };
}

async function readJsonBody(init?: RequestInit): Promise<Record<string, unknown>> {
  if (!init?.body) return {};
  if (typeof init.body === "string") {
    return JSON.parse(init.body) as Record<string, unknown>;
  }
  return {};
}

async function dispatchLocalRuntime(
  event: RuntimeEvent,
  normalizedPath: string,
  init?: RequestInit,
): Promise<Response | null> {
  const runtimeEnv = getLocalRuntimeEnv(event);
  if (!runtimeEnv) return null;

  const runtime = await import("$lib/runtime/agent-runtime");
  const match = normalizedPath.match(
    /^\/runtime\/workspaces\/([^/]+)(\/agents\/[^/]+(?:\/tasks|\/cancel)?|\/health)?$/,
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

  const taskMatch = suffix.match(/^\/agents\/([^/]+)\/tasks$/);
  if ((init?.method ?? "GET") === "POST" && taskMatch) {
    const agentId = taskMatch[1];
    const body = await readJsonBody(init);
    const content = typeof body.content === "string" ? body.content.trim() : "";
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

    try {
      const accepted = await runtime.acceptAgentTask(runtimeEnv, workspaceId, agentId, content, requestId);
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
