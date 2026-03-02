<script lang="ts">
  import StatusDot from "$lib/components/shared/StatusDot.svelte";
  import ChatView from "./ChatView.svelte";
  import ChatInput from "./ChatInput.svelte";
  import { STATUS_COLORS, STATUS_LABELS } from "$lib/protocol";
  import type { AgentNode, ProcessEntry } from "$lib/types/session";
  import type { ChatMsg } from "./ChatView.svelte";

  interface Props {
    agent: AgentNode | null;
    messages: ChatMsg[];
    onsend: (message: string) => void;
    onnavigate?: (name: string) => void;
    processes?: ProcessEntry[];
    processError?: string | null;
    selectedProcessId?: string | null;
    onselectprocess?: (processId: string) => void;
    viewMode?: "chat" | "terminal";
    terminalUrl?: string | null;
    terminalError?: string | null;
    onopenterminal?: () => void;
    oncloseterminal?: () => void;
  }

  let {
    agent,
    messages,
    onsend,
    onnavigate,
    processes = [],
    processError = null,
    selectedProcessId = null,
    onselectprocess,
    viewMode = "chat",
    terminalUrl = null,
    terminalError = null,
    onopenterminal,
    oncloseterminal,
  }: Props = $props();

</script>

{#if agent}
  <div class="panel">
    <div class="panel-header">
      <div class="panel-left">
        <StatusDot status={agent.status} size={7} />
        <span class="panel-name">{agent.name}</span>
        <span class="panel-status" style:color={STATUS_COLORS[agent.status]}>
          {STATUS_LABELS[agent.status]}
        </span>
      </div>
      <div class="panel-right">
        <span class="panel-tag">thread</span>
        <span class="panel-tag">{agent.agentType}</span>
        <span class="panel-tag">{agent.model}</span>
        {#if agent.tokens > 0}
          <span class="panel-tokens">{agent.tokens.toLocaleString()}t</span>
        {/if}
      </div>
    </div>
    <div class="panel-body">
      {#if viewMode === "terminal"}
        {#if terminalUrl}
          <iframe
            src={terminalUrl}
            class="terminal-frame"
            title={`${agent.name} terminal`}
          ></iframe>
        {:else}
          <div class="panel-empty panel-inline-empty">
            <span>{terminalError ?? "Terminal unavailable for this thread."}</span>
          </div>
        {/if}
      {:else}
        <ChatView
          {messages}
          status={agent.status}
          {onnavigate}
        />
      {/if}
    </div>
    <div class="process-dock">
      <div class="process-row">
        <span class="process-label">Processes</span>
        {#if processError}
          <span class="process-error">{processError}</span>
        {:else if processes.length > 0}
          {#if viewMode === "terminal"}
            <button class="process-action" onclick={() => oncloseterminal?.()}>Back To Chat</button>
          {:else}
            <button class="process-action" onclick={() => onopenterminal?.()}>Open Workspace Terminal</button>
          {/if}
        {/if}
      </div>
      {#if processes.length > 0}
        <div class="process-list">
          {#each processes as process}
            <button
              class="process-chip"
              class:selected={process.id === selectedProcessId}
              onclick={() => onselectprocess?.(process.id)}
            >
              <span class="process-chip-dot" data-status={process.status}></span>
              <span class="process-chip-name">{process.name}</span>
            </button>
          {/each}
        </div>
      {:else}
        <div class="process-empty">No live processes for this thread.</div>
      {/if}
    </div>
    {#if viewMode !== "terminal"}
      <ChatInput {onsend} />
    {/if}
  </div>
{:else}
  <div class="panel-empty">
    <span>Select a thread</span>
  </div>
{/if}

<style>
  .panel {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .panel-header {
    padding: 8px 16px;
    border-bottom: 1px solid var(--b1);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }
  .panel-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .panel-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .panel-name {
    font-family: var(--m);
    font-size: 13px;
    font-weight: 600;
    color: var(--t1);
  }
  .panel-status {
    font-family: var(--m);
    font-size: 10px;
  }
  .panel-tag {
    font-family: var(--m);
    font-size: 9px;
    color: var(--t5);
    background: var(--bg3);
    padding: 2px 7px;
    border-radius: 3px;
    border: 1px solid var(--b1);
  }
  .panel-tokens {
    font-family: var(--m);
    font-size: 9px;
    color: var(--t6);
  }
  .panel-body {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .panel-inline-empty {
    border-bottom: 1px solid var(--b1);
  }
  .terminal-frame {
    width: 100%;
    height: 100%;
    border: 0;
    background: #000;
  }
  .process-dock {
    border-top: 1px solid var(--b1);
    padding: 8px 16px 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .process-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .process-label {
    font-family: var(--m);
    font-size: 10px;
    color: var(--t5);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .process-error {
    font-family: var(--m);
    font-size: 10px;
    color: var(--t5);
  }
  .process-action {
    border: 1px solid var(--b2);
    background: var(--bg2);
    color: var(--t3);
    border-radius: 7px;
    padding: 5px 9px;
    font-family: var(--m);
    font-size: 10px;
    cursor: pointer;
  }
  .process-list {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 2px;
  }
  .process-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--b2);
    background: var(--bg2);
    color: var(--t4);
    border-radius: 999px;
    padding: 6px 10px;
    font-family: var(--m);
    font-size: 10px;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .process-chip.selected {
    border-color: color-mix(in srgb, var(--accent) 30%, transparent);
    color: var(--t1);
    background: color-mix(in srgb, var(--accent) 8%, var(--bg));
  }
  .process-chip-dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: var(--t5);
    flex-shrink: 0;
  }
  .process-chip-dot[data-status="running"] {
    background: #22c55e;
  }
  .process-chip-dot[data-status="starting"] {
    background: #f59e0b;
  }
  .process-chip-dot[data-status="exited"] {
    background: #94a3b8;
  }
  .process-chip-name {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .process-empty {
    font-family: var(--m);
    font-size: 10px;
    color: var(--t5);
  }
  .panel-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--t6);
    font-family: var(--m);
    font-size: 12px;
  }
</style>
