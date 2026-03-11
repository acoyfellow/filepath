<script lang="ts">
  import StatusDot from "$lib/components/shared/StatusDot.svelte";
  import { STATUS_COLORS, STATUS_LABELS } from "$lib/protocol";
  import type { AgentRecord, AgentResult } from "$lib/types/workspace";
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
    agent: AgentRecord | null;
    messages: ChatMsg[];
    result?: AgentResult | null;
    notice?: AgentNotice | null;
    onsend: (message: string) => void;
    oncancel?: () => void;
    onnavigate?: (name: string) => void;
  }

  let { agent, messages, result = null, notice = null, onsend, oncancel, onnavigate }: Props = $props();

  let isExhausted = $derived(agent?.status === "exhausted");
  let isBusy = $derived(agent?.status === "thinking" || agent?.status === "running");
  let composerDisabled = $derived(Boolean(isExhausted || notice?.blocking));
  let composerPlaceholder = $derived.by(() => {
    if (notice?.blocking) return notice.title;
    if (isExhausted) return "Agent exhausted";
    if (agent?.status === "idle" && messages.length === 0) return "Start the first task...";
    return "Describe the next task...";
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
        <span class="panel-tag">{agent.harnessId}</span>
        <span class="panel-tag">{agent.model}</span>
        <span class="panel-tag">scope {agent.writableRoot ?? "."}</span>
        {#if agent.tokens > 0}
          <span class="panel-tokens">{agent.tokens.toLocaleString()}t</span>
        {/if}
        {#if isBusy && oncancel}
          <button class="panel-cancel" onclick={oncancel}>cancel</button>
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
          <div>This agent is ready for its first task.</div>
        </div>
      {/if}
      {#if isExhausted}
        <div class="readonly-banner">
          This agent is exhausted. Its history remains visible, but it is read-only for now.
        </div>
      {/if}
      {#if result}
        <div class="result-card">
          <div class="result-header">
            <span class="result-title">latest result</span>
            <span class={`result-status result-status-${result.status}`}>{result.status}</span>
          </div>
          <div class="result-summary">{result.summary}</div>
          {#if result.commands.length > 0}
            <div class="result-meta">
              <strong>commands</strong>
              <ol class="result-command-list">
                {#each result.commands as cmd}
                  <li>
                    <code>{cmd.command}</code>
                    {#if cmd.exitCode !== null}
                      <span class="result-exit">exit {cmd.exitCode}</span>
                    {/if}
                  </li>
                {/each}
              </ol>
            </div>
          {/if}
          {#if result.filesTouched.length > 0}
            <div class="result-meta">
              <strong>files</strong>
              <span>{result.filesTouched.join(", ")}</span>
            </div>
          {/if}
          {#if result.violations.length > 0}
            <div class="result-meta">
              <strong>violations</strong>
              <span>{result.violations.join(", ")}</span>
            </div>
          {/if}
          {#if result.diffSummary}
            <div class="result-meta">
              <strong>diff</strong>
              <span>{result.diffSummary}</span>
            </div>
          {/if}
          {#if result.commit}
            <div class="result-meta">
              <strong>commit</strong>
              <span>{result.commit.sha} · {result.commit.message}</span>
            </div>
          {/if}
        </div>
      {/if}
      <ChatView
        {messages}
        status={agent.status}
        {onnavigate}
      />
    </div>

    <ChatInput {onsend} disabled={composerDisabled} placeholder={composerPlaceholder} actionLabel="Send task" />
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

  .panel-cancel {
    border: 1px solid color-mix(in srgb, #ef4444 35%, var(--b1));
    background: color-mix(in srgb, #ef4444 10%, transparent);
    color: #dc2626;
    border-radius: 999px;
    padding: 3px 8px;
    font-family: var(--m);
    font-size: 10px;
    cursor: pointer;
  }

  .panel-cancel:hover {
    background: color-mix(in srgb, #ef4444 16%, transparent);
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

  .result-card {
    margin: 12px 16px 0;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--b1);
    background: var(--bg2);
    font-family: var(--m);
    font-size: 11px;
    line-height: 1.5;
  }

  .result-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }

  .result-title {
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--t5);
  }

  .result-status {
    font-size: 10px;
    font-weight: 600;
  }

  .result-status-success {
    color: #15803d;
  }

  .result-status-error,
  .result-status-policy_error {
    color: #dc2626;
  }

  .result-status-aborted {
    color: #b45309;
  }

  .result-summary {
    color: var(--t2);
  }

  .result-meta {
    display: grid;
    gap: 2px;
    margin-top: 8px;
    color: var(--t4);
  }

  .result-command-list {
    margin: 4px 0 0;
    padding-left: 16px;
    list-style: decimal;
    font-family: var(--m);
    font-size: 10px;
  }

  .result-command-list code {
    font-size: 10px;
    background: var(--bg3);
    padding: 2px 4px;
    border-radius: 3px;
  }

  .result-exit {
    margin-left: 6px;
    color: var(--t5);
    font-size: 9px;
  }
</style>
