/**
 * MCPAgent WebSocket RPC client.
 *
 * Connects to the MCPAgent Durable Object via `agents/client`. Each user has
 * exactly one MCPAgent instance (name = userId). The browser drives OAuth
 * (popup + callback) and tool listing/calling via @callable RPC methods.
 *
 * Note: this connects to the WORKER (api.myfilepath.com in prod), NOT the
 * SvelteKit app — MCPAgent DO lives on the worker where routeAgentRequest runs.
 */

import { AgentClient } from "agents/client";

export type ServerState = {
  id: string;
  name: string;
  state: string;
  authUrl: string | null;
};

export type ConnectResult =
  | { id: string; state: "ready" }
  | { id: string; state: "authenticating"; authUrl: string };

export type MCPToolInfo = {
  name: string;
  serverId: string;
  description?: string;
  inputSchema?: unknown;
};

export interface MCPClientCallbacks {
  onStatus?: (status: "connecting" | "connected" | "closed") => void;
  onError?: (error: string) => void;
}

function parseBaseUrl(baseUrl: string): { host: string; protocol: "ws" | "wss" } {
  const u = new URL(baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`);
  return {
    host: u.host,
    protocol: u.protocol === "https:" ? "wss" : "ws",
  };
}

/**
 * Create an AgentClient bound to a user's MCPAgent instance.
 *
 * @param userId the authenticated user's id — used as the DO instance name
 * @param workerBaseUrl the worker's public origin (e.g. https://api.myfilepath.com).
 *   MUST match what addMcpServer uses as callbackHost.
 */
export function createMCPAgentClient(
  userId: string,
  workerBaseUrl: string,
  callbacks: MCPClientCallbacks = {},
): AgentClient {
  const { host, protocol } = parseBaseUrl(workerBaseUrl);

  const client = new AgentClient({
    agent: "MCPAgent",
    name: userId,
    host,
    protocol,
  });

  client.addEventListener("open", () => callbacks.onStatus?.("connected"));
  client.addEventListener("close", () => callbacks.onStatus?.("closed"));
  client.addEventListener("error", (e) => {
    callbacks.onError?.(e instanceof Error ? e.message : "MCPAgent socket error");
  });

  return client;
}

/**
 * Thin typed wrappers around client.call() for the @callable methods on MCPAgent.
 * Keeps invocation sites clean and gives us inference.
 */
export const mcpRpc = {
  async connectPortal(client: AgentClient, callbackHost: string): Promise<ConnectResult> {
    return (await client.call("connectPortal", [callbackHost])) as ConnectResult;
  },

  async getState(client: AgentClient): Promise<ServerState[]> {
    return (await client.call("getState", [])) as ServerState[];
  },

  async listTools(client: AgentClient): Promise<MCPToolInfo[]> {
    return (await client.call("listTools", [])) as MCPToolInfo[];
  },

  async callTool(
    client: AgentClient,
    serverId: string,
    toolName: string,
    args: Record<string, unknown> = {},
  ): Promise<unknown> {
    return await client.call("callTool", [serverId, toolName, args]);
  },

  async disconnect(client: AgentClient, serverId: string): Promise<{ ok: true }> {
    return (await client.call("disconnect", [serverId])) as { ok: true };
  },
};

/**
 * Open a popup to the authUrl and resolve when the popup posts a message back
 * (via `/oauth-close` page, which emits `{type:"mcp-oauth",success:boolean}`
 * via postMessage AND BroadcastChannel).
 *
 * Falls back to detecting popup close if no message arrives.
 */
export function openOAuthPopup(authUrl: string): Promise<{ success: boolean }> {
  return new Promise((resolve) => {
    const popup = window.open(authUrl, "mcp-oauth", "width=640,height=720");
    if (!popup) {
      resolve({ success: false });
      return;
    }

    let settled = false;
    const settle = (success: boolean) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      try { bc?.close(); } catch {}
      clearInterval(pollTimer);
      resolve({ success });
    };

    const onMessage = (ev: MessageEvent) => {
      const data = ev.data as { type?: string; success?: boolean } | undefined;
      if (data?.type === "mcp-oauth") settle(!!data.success);
    };
    window.addEventListener("message", onMessage);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("mcp-oauth");
      bc.onmessage = (ev) => {
        const data = ev.data as { success?: boolean } | undefined;
        if (data && "success" in data) settle(!!data.success);
      };
    } catch {
      // BroadcastChannel unavailable; postMessage path is enough.
    }

    // Fallback: if the popup closes without posting, assume success
    // (user may have dismissed the close page before it fired).
    const pollTimer = setInterval(() => {
      if (popup.closed) settle(true);
    }, 500);
  });
}
