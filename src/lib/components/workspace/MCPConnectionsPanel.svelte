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

  async function connectPortal(): Promise<void> {
    if (!client) return;
    busy = "cf-portal";
    error = null;
    try {
      await client.ready;
      const result = await mcpRpc.connectPortal(client, workerBaseUrl);
      if (result.state === "authenticating") {
        const popupResult = await openOAuthPopup(result.authUrl);
        if (!popupResult.success) {
          error = "Authentication popup did not complete.";
        }
        // Give the DO a moment to finish the token exchange, then refresh.
        await new Promise((r) => setTimeout(r, 500));
        await refresh();
      } else {
        await refresh();
      }
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

  const portalConnected = $derived(
    servers.some((s) => s.name === "cf-portal" && s.state === "ready"),
  );
  const portalServer = $derived(servers.find((s) => s.name === "cf-portal"));
</script>

<div
  class="flex flex-col gap-3 rounded-md border border-(--b1) bg-(--bg2) p-4"
  data-testid="mcp-connections-panel"
>
  <div class="flex items-center justify-between gap-2">
    <div class="flex flex-col">
      <span class="text-[13px] font-medium text-(--t1)">MCP servers</span>
      <span class="text-[11px] text-(--t4)"
        >Connect external MCPs for tool access.</span
      >
    </div>
    <button
      type="button"
      class="inline-flex size-7 items-center justify-center rounded-full text-(--t5) hover:bg-(--bg3) hover:text-(--t2) disabled:opacity-40"
      aria-label="Refresh"
      onclick={refresh}
      disabled={status !== "connected" || busy !== null}
    >
      <RefreshCwIcon size={13} />
    </button>
  </div>

  {#if error}
    <div class="rounded-sm border border-(--err,#c33) bg-(--err-bg,rgba(204,51,51,0.08)) px-2 py-1.5 text-[11px] text-(--err,#c33)">
      {error}
    </div>
  {/if}

  <!-- cf-portal row (hardcoded; Phase 1 single-server MVP) -->
  <div
    class="flex items-center justify-between gap-2 rounded-sm border border-(--b1) bg-(--bg) px-3 py-2"
    data-testid="mcp-row-cf-portal"
  >
    <div class="flex min-w-0 items-center gap-2">
      {#if portalConnected}
        <PlugZapIcon size={14} style="color: var(--ok, #2a7);" />
      {:else}
        <PlugIcon size={14} style="color: var(--t4);" />
      {/if}
      <div class="flex min-w-0 flex-col">
        <span class="truncate text-[12px] font-medium text-(--t1)">cf-portal</span>
        <span
          class="truncate text-[10px]"
          style:color={portalServer ? stateColor(portalServer.state) : "var(--t4)"}
        >
          {portalServer ? stateLabel(portalServer.state) : "not connected"}
        </span>
      </div>
    </div>
    <div class="flex items-center gap-1">
      {#if portalConnected || portalServer}
        <button
          type="button"
          class="inline-flex size-7 items-center justify-center rounded-full text-(--t5) hover:bg-(--bg3) hover:text-(--err,#c33) disabled:opacity-40"
          aria-label="Disconnect cf-portal"
          onclick={() => portalServer && disconnect(portalServer.id)}
          disabled={busy !== null}
          data-testid="mcp-disconnect-cf-portal"
        >
          <Trash2Icon size={13} />
        </button>
      {:else}
        <button
          type="button"
          class="inline-flex h-7 items-center justify-center rounded-sm border border-(--b1) bg-(--bg) px-2 text-[11px] font-medium text-(--t2) hover:border-(--accent) hover:text-(--accent) disabled:opacity-40"
          onclick={connectPortal}
          disabled={status !== "connected" || busy !== null}
          data-testid="mcp-connect-cf-portal"
        >
          {busy === "cf-portal" ? "connecting…" : "connect"}
        </button>
      {/if}
    </div>
  </div>

  {#if status !== "connected"}
    <div class="text-[10px] text-(--t4)">
      {status === "connecting" ? "connecting to MCPAgent…" : "disconnected"}
    </div>
  {/if}
</div>
