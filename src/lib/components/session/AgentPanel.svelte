<script lang="ts">
  import StatusDot from "$lib/components/shared/StatusDot.svelte";
  import { STATUS_COLORS, STATUS_LABELS } from "$lib/protocol";
  import type { AgentNode } from "$lib/types/session";
  import ChatInput from "./ChatInput.svelte";
  import type { ChatMsg } from "./ChatView.svelte";
  import ChatView from "./ChatView.svelte";

  type AgentNotice = {
    tone: "info" | "warning" | "error" | "success";
    title: string;
    message: string;
    blocking?: boolean;
  };

  interface Props {
    agent: AgentNode | null;
    messages: ChatMsg[];
    notice?: AgentNotice | null;
    onsend: (message: string) => void;
    onnavigate?: (name: string) => void;
  }

  let { agent, messages, notice = null, onsend, onnavigate }: Props = $props();

  let isExhausted = $derived(agent?.status === "exhausted");
  let composerDisabled = $derived(Boolean(isExhausted || notice?.blocking));
  let composerPlaceholder = $derived.by(() => {
    if (notice?.blocking) return notice.title;
    if (isExhausted) return "Agent exhausted";
    if (agent?.status === "idle" && messages.length === 0) return "Send the first message...";
    return "Message...";
  });
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
        <span class="panel-tag">agent</span>
        <span class="panel-tag">{agent.harnessId}</span>
        <span class="panel-tag">{agent.model}</span>
        {#if agent.tokens > 0}
          <span class="panel-tokens">{agent.tokens.toLocaleString()}t</span>
        {/if}
      </div>
    </div>

    <div class="panel-body">
      {#if notice}
        <div class={`panel-notice panel-notice-${notice.tone}`}>
          <div class="panel-notice-title">{notice.title}</div>
          <div>{notice.message}</div>
        </div>
      {:else if agent.status === "idle" && messages.length === 0}
        <div class="panel-notice panel-notice-info">
          <div class="panel-notice-title">Ready</div>
          <div>This agent is ready for its first message.</div>
        </div>
      {/if}
      {#if isExhausted}
        <div class="readonly-banner">
          This agent is exhausted. Its history remains visible, but it is read-only for now.
        </div>
      {/if}
      <ChatView
        {messages}
        status={agent.status}
        {onnavigate}
      />
    </div>

    <ChatInput {onsend} disabled={composerDisabled} placeholder={composerPlaceholder} />
  </div>
{:else}
  <div class="panel-empty">
    <span>Select an agent</span>
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

  .panel-left,
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
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .panel-empty {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--t6);
    font-family: var(--m);
    font-size: 12px;
  }

  .readonly-banner {
    padding: 10px 16px;
    border-bottom: 1px solid var(--b1);
    font-family: var(--m);
    font-size: 11px;
    color: #fb923c;
    background: color-mix(in srgb, #fb923c 10%, transparent);
  }

  .panel-notice {
    margin: 12px 16px 0;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--b1);
    font-family: var(--m);
    font-size: 11px;
    line-height: 1.5;
  }

  .panel-notice-title {
    font-weight: 600;
    margin-bottom: 4px;
  }

  .panel-notice-info {
    color: var(--t3);
    background: color-mix(in srgb, var(--accent) 7%, transparent);
  }

  .panel-notice-warning {
    color: #b45309;
    background: color-mix(in srgb, #f59e0b 12%, transparent);
  }

  .panel-notice-error {
    color: #dc2626;
    background: color-mix(in srgb, #ef4444 10%, transparent);
  }

  .panel-notice-success {
    color: #15803d;
    background: color-mix(in srgb, #22c55e 10%, transparent);
  }
</style>
