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
 * Scope: Phase 1 wires cf-portal (portal.mcp.cfdata.org) specifically.
 * Generic multi-server UI ships in later phases.
 */

import { Agent, callable } from "agents";

export interface MCPAgentEnv {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
}

/** Shape returned by addMcpServer — narrowed from the overloaded HTTP variant. */
export type ConnectResult =
  | { id: string; state: "ready" }
  | { id: string; state: "authenticating"; authUrl: string };

export interface ServerState {
  id: string;
  name: string;
  state: string;
  authUrl: string | null;
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
   * Connect cf-portal MCP server. Returns authUrl on first call (UI opens
   * as popup); subsequent calls return existing ready connection.
   *
   * callbackHost must be the worker's public origin (e.g. https://api.myfilepath.com)
   * — MUST match where /agents/m-c-p-agent/<user>/callback routes back to.
   */
  @callable({ description: "Connect cf-portal MCP" })
  async connectPortal(callbackHost: string): Promise<ConnectResult> {
    const result = await this.addMcpServer(
      "cf-portal",
      "https://portal.mcp.cfdata.org/sse",
      { callbackHost },
    );
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
