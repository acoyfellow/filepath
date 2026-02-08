<script lang="ts">
  import StatusDot from "$lib/components/shared/StatusDot.svelte";
  import ChatView from "./ChatView.svelte";
  import ChatInput from "./ChatInput.svelte";
  import { STATUS_COLORS, STATUS_LABELS } from "$lib/protocol";
  import type { AgentNode } from "$lib/types/session";
  import type { ChatMsg } from "./ChatView.svelte";

  interface Props {
    agent: AgentNode | null;
    messages: ChatMsg[];
    onsend: (message: string) => void;
    onnavigate?: (name: string) => void;
  }

  let { agent, messages, onsend, onnavigate }: Props = $props();
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
        <span class="panel-tag">{agent.agentType}</span>
        <span class="panel-tag">{agent.model}</span>
        {#if agent.tokens > 0}
          <span class="panel-tokens">{agent.tokens.toLocaleString()}t</span>
        {/if}
      </div>
    </div>
    <div class="panel-body">
      <ChatView
        {messages}
        status={agent.status}
        {onnavigate}
      />
    </div>
    <ChatInput {onsend} />
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
