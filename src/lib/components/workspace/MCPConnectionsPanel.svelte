<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { AgentClient } from "agents/client";
  import {
    createMCPAgentClient,
    mcpRpc,
    openOAuthPopup,
    type ServerState,
  } from "$lib/agents/mcp-agent-client.svelte";
  import PlugIcon from "@lucide/svelte/icons/plug";
  import PlugZapIcon from "@lucide/svelte/icons/plug-zap";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import PlusIcon from "@lucide/svelte/icons/plus";

  interface Props {
    userId: string;
    workerBaseUrl: string;
  }

  let { userId, workerBaseUrl }: Props = $props();

  let client: AgentClient | null = $state(null);
  let servers: ServerState[] = $state([]);
  let status: "connecting" | "connected" | "closed" = $state("connecting");
  let busy: string | null = $state(null);
  let error: string | null = $state(null);

  // Add-server form state
  let showAddForm = $state(false);
  let newName = $state("");
  let newUrl = $state("");

  onMount(() => {
    if (!userId || !workerBaseUrl) return;
    client = createMCPAgentClient(userId, workerBaseUrl, {
      onStatus: (s) => {
        status = s;
        if (s === "connected") void refresh();
      },
      onError: (e) => (error = e),
    });
  });

  onDestroy(() => {
    client?.close();
    client = null;
  });

  async function refresh(): Promise<void> {
    if (!client) return;
    try {
      await client.ready;
      servers = await mcpRpc.getState(client);
      error = null;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  /**
   * Poll getState every 500ms until the target server reaches a terminal state
   * (ready | failed) or the timeout expires. Used after OAuth completes because
   * the DO's background connection work can take a second or two to finish
   * after the token exchange, and a single refresh() often snapshots mid-flight.
   */
  async function pollUntilSettled(serverId: string, timeoutMs = 10_000): Promise<void> {
    if (!client) return;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await refresh();
      const target = servers.find((s) => s.id === serverId);
      if (!target) return;
      if (target.state === "ready" || target.state === "failed") return;
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  async function addServer(): Promise<void> {
    if (!client) return;
    const name = newName.trim();
    const url = newUrl.trim();
    if (!name) {
      error = "Server name is required.";
      return;
    }
    if (!url) {
      error = "Server URL is required.";
      return;
    }
    busy = "__add__";
    error = null;
    try {
      await client.ready;
      const result = await mcpRpc.connectServer(client, name, url, workerBaseUrl);
      if (result.state === "authenticating") {
        const popupResult = await openOAuthPopup(result.authUrl);
        if (!popupResult.success) {
          error = "Authentication popup did not complete.";
        }
      }
      // Poll until the DO's background connect work settles, so the UI
      // doesn't show "authenticating" after the popup says success.
      await pollUntilSettled(result.id);
      newName = "";
      newUrl = "";
      showAddForm = false;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = null;
    }
  }

  async function reconnect(server: ServerState): Promise<void> {
    if (!client) return;
    busy = server.id;
    error = null;
    try {
      await client.ready;
      const result = await mcpRpc.connectServer(
        client,
        server.name,
        server.url,
        workerBaseUrl,
      );
      if (result.state === "authenticating") {
        const popupResult = await openOAuthPopup(result.authUrl);
        if (!popupResult.success) {
          error = "Authentication popup did not complete.";
        }
      }
      await pollUntilSettled(result.id);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = null;
    }
  }

  async function disconnect(serverId: string): Promise<void> {
    if (!client) return;
    busy = serverId;
    error = null;
    try {
      await mcpRpc.disconnect(client, serverId);
      await refresh();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = null;
    }
  }

  function stateLabel(s: string): string {
    switch (s) {
      case "ready":
        return "ready";
      case "authenticating":
        return "awaiting auth";
      case "connecting":
      case "discovering":
        return s;
      case "failed":
        return "failed";
      case "no-connection":
        return "offline";
      default:
        return s;
    }
  }

  function stateColor(s: string): string {
    if (s === "ready") return "var(--ok, #2a7)";
    if (s === "failed") return "var(--err, #c33)";
    if (s === "authenticating") return "var(--warn, #c90)";
    return "var(--t4)";
  }

  function cancelAdd(): void {
    showAddForm = false;
    newName = "";
    newUrl = "";
    error = null;
  }
</script>

<div
  class="flex flex-col gap-3 rounded-md border border-(--b1) bg-(--bg2) p-4"
  data-testid="mcp-connections-panel"
>
  <div class="flex items-center justify-between gap-2">
    <div class="flex flex-col">
      <span class="text-[13px] font-medium text-(--t1)">MCP servers</span>
      <span class="text-[11px] text-(--t4)"
        >Add MCP servers by URL. OAuth flows run in a popup.</span
      >
    </div>
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="inline-flex size-7 items-center justify-center rounded-full text-(--t5) hover:bg-(--bg3) hover:text-(--t2) disabled:opacity-40"
        aria-label="Refresh"
        onclick={refresh}
        disabled={status !== "connected" || busy !== null}
      >
        <RefreshCwIcon size={13} />
      </button>
      <button
        type="button"
        class="inline-flex h-7 items-center gap-1 rounded-sm border border-(--b1) bg-(--bg) px-2 text-[11px] font-medium text-(--t2) hover:border-(--accent) hover:text-(--accent) disabled:opacity-40"
        onclick={() => {
          showAddForm = true;
          error = null;
        }}
        disabled={status !== "connected" || busy !== null || showAddForm}
        data-testid="mcp-add-button"
      >
        <PlusIcon size={12} />
        add
      </button>
    </div>
  </div>

  {#if error}
    <div
      class="rounded-sm border border-(--err,#c33) bg-(--err-bg,rgba(204,51,51,0.08)) px-2 py-1.5 text-[11px] text-(--err,#c33)"
    >
      {error}
    </div>
  {/if}

  {#if showAddForm}
    <div
      class="flex flex-col gap-2 rounded-sm border border-(--accent) bg-(--bg) p-3"
      data-testid="mcp-add-form"
    >
      <div class="flex flex-col gap-1">
        <label for="mcp-new-name" class="text-[10px] font-medium uppercase tracking-wide text-(--t4)">
          Name
        </label>
        <input
          id="mcp-new-name"
          type="text"
          placeholder="github"
          bind:value={newName}
          class="rounded-sm border border-(--b1) bg-(--bg2) px-2 py-1.5 text-[12px] text-(--t1) outline-none focus:border-(--accent)"
          disabled={busy !== null}
        />
      </div>
      <div class="flex flex-col gap-1">
        <label for="mcp-new-url" class="text-[10px] font-medium uppercase tracking-wide text-(--t4)">
          URL
        </label>
        <input
          id="mcp-new-url"
          type="url"
          placeholder="https://mcp.example.com/sse"
          bind:value={newUrl}
          class="rounded-sm border border-(--b1) bg-(--bg2) px-2 py-1.5 text-[12px] text-(--t1) outline-none focus:border-(--accent)"
          disabled={busy !== null}
          onkeydown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addServer();
            }
          }}
        />
        <span class="text-[10px] text-(--t4)"
          >SSE or streamable-http endpoint. OAuth (DCR + PKCE) is handled automatically.</span
        >
      </div>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="h-7 rounded-sm border border-(--b1) bg-(--bg) px-3 text-[11px] font-medium text-(--t3) hover:border-(--t4) hover:text-(--t2) disabled:opacity-40"
          onclick={cancelAdd}
          disabled={busy !== null}
        >
          cancel
        </button>
        <button
          type="button"
          class="h-7 rounded-sm border border-(--accent) bg-(--accent) px-3 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-40"
          onclick={addServer}
          disabled={busy !== null || !newName.trim() || !newUrl.trim()}
          data-testid="mcp-add-submit"
        >
          {busy === "__add__" ? "connecting…" : "connect"}
        </button>
      </div>
    </div>
  {/if}

  {#if servers.length === 0}
    {#if !showAddForm}
      <div class="rounded-sm border border-dashed border-(--b1) px-3 py-4 text-center text-[11px] text-(--t4)">
        No MCP servers connected yet. Click <strong>add</strong> to connect one.
      </div>
    {/if}
  {:else}
    <div class="flex flex-col gap-2">
      {#each servers as server (server.id)}
        <div
          class="flex items-center justify-between gap-2 rounded-sm border border-(--b1) bg-(--bg) px-3 py-2"
          data-testid={`mcp-row-${server.id}`}
        >
          <div class="flex min-w-0 items-center gap-2">
            {#if server.state === "ready"}
              <PlugZapIcon size={14} style="color: var(--ok, #2a7);" />
            {:else}
              <PlugIcon size={14} style="color: var(--t4);" />
            {/if}
            <div class="flex min-w-0 flex-col">
              <span class="truncate text-[12px] font-medium text-(--t1)">{server.name}</span>
              <span class="truncate text-[10px] text-(--t4)">{server.url}</span>
              <span
                class="truncate text-[10px]"
                style:color={stateColor(server.state)}
              >
                {stateLabel(server.state)}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-1">
            {#if server.state !== "ready"}
              <button
                type="button"
                class="h-7 rounded-sm border border-(--b1) bg-(--bg) px-2 text-[10px] font-medium text-(--t2) hover:border-(--accent) hover:text-(--accent) disabled:opacity-40"
                onclick={() => reconnect(server)}
                disabled={busy !== null}
                data-testid={`mcp-reconnect-${server.id}`}
              >
                {busy === server.id ? "…" : "retry"}
              </button>
            {/if}
            <button
              type="button"
              class="inline-flex size-7 items-center justify-center rounded-full text-(--t5) hover:bg-(--bg3) hover:text-(--err,#c33) disabled:opacity-40"
              aria-label={`Disconnect ${server.name}`}
              onclick={() => disconnect(server.id)}
              disabled={busy !== null}
              data-testid={`mcp-disconnect-${server.id}`}
            >
              <Trash2Icon size={13} />
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if status !== "connected"}
    <div class="text-[10px] text-(--t4)">
      {status === "connecting" ? "connecting to MCPAgent…" : "disconnected"}
    </div>
  {/if}
</div>
