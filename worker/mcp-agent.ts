/**
 * MCPAgent - Durable Object for OAuth-gated MCP client sessions.
 *
 * One instance per user (`name = userId`). Holds long-lived MCP server
 * connections + OAuth tokens via cloudflare/agents' built-in MCPClientManager.
 *
 * The `Agent` base class already wires the OAuth callback route
 * (/agents/m-c-p-agent/<user>/callback) through `handleMcpOAuthCallback`.
 * No custom OAuth code written here — DCR + PKCE + refresh + storage
 * are all provided by `cloudflare/agents`.
 *
 * Generic: users add any MCP server by URL. No hardcoded servers.
 */

import { Agent, callable } from "agents";

export interface MCPAgentEnv {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
}

export type ConnectResult =
  | { id: string; state: "ready" }
  | { id: string; state: "authenticating"; authUrl: string };

export interface ServerState {
  id: string;
  name: string;
  url: string;
  state: string;
  authUrl: string | null;
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid MCP server URL: ${trimmed}`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Unsupported protocol: ${parsed.protocol}`);
  }
  return parsed.href;
}

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Server name is required.");
  if (trimmed.length > 64) throw new Error("Server name is too long (max 64).");
  return trimmed;
}

export class MCPAgent extends Agent<MCPAgentEnv> {
  async onStart() {
    // Popup redirects here after token exchange completes.
    this.mcp.configureOAuthCallback({
      successRedirect: "/oauth-close?success=1",
      errorRedirect: "/oauth-close?success=0",
    });
  }

  /**
   * Connect (or reconnect) an MCP server by URL.
   *
   * @param name short friendly name the user sees in the UI (e.g. "github")
   * @param url the MCP server URL (SSE or streamable-http endpoint)
   * @param callbackHost worker origin — MUST match where
   *   /agents/m-c-p-agent/<userId>/callback routes back to.
   */
  @callable({ description: "Connect an MCP server by URL" })
  async connectServer(
    name: string,
    url: string,
    callbackHost: string,
  ): Promise<ConnectResult> {
    const safeName = normalizeName(name);
    const safeUrl = normalizeUrl(url);
    const result = await this.addMcpServer(safeName, safeUrl, { callbackHost });
    return result as ConnectResult;
  }

  @callable({ description: "List connected servers with state" })
  getState(): ServerState[] {
    const servers = this.mcp.listServers();
    return servers.map((s) => {
      const conn = this.mcp.mcpConnections[s.id];
      return {
        id: s.id,
        name: s.name,
        url: s.server_url,
        state: conn?.connectionState ?? "no-connection",
        authUrl: s.auth_url ?? null,
      };
    });
  }

  @callable({ description: "List tools across all connected MCP servers" })
  listTools(): Array<{
    name: string;
    serverId: string;
    description?: string;
    inputSchema?: unknown;
  }> {
    return this.mcp.listTools().map((t) => ({
      name: t.name,
      serverId: t.serverId,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }

  @callable({ description: "Call an MCP tool by server id + name" })
  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown> = {},
  ): Promise<unknown> {
    return await this.mcp.callTool({
      serverId,
      name: toolName,
      arguments: args,
    });
  }

  @callable({ description: "Remove a connected server (disconnect + forget)" })
  async disconnect(serverId: string): Promise<{ ok: true }> {
    await this.mcp.removeServer(serverId);
    return { ok: true };
  }
}
