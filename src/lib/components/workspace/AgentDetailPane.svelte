<script lang="ts">
  import StatusDot from "$lib/components/shared/StatusDot.svelte";
  import { STATUS_COLORS, STATUS_LABELS } from "$lib/protocol";
  import type { AgentRecord, AgentResult } from "$lib/types/workspace";
  import TaskComposer from "./TaskComposer.svelte";
  import type { TaskMessage } from "./TaskTranscript.svelte";
  import TaskTranscript from "./TaskTranscript.svelte";

  type AgentNotice = {
    tone: "info" | "warning" | "error" | "success";
    title: string;
    message: string;
    blocking?: boolean;
  };

  interface Props {
    agent: AgentRecord | null;
    messages: TaskMessage[];
    result?: AgentResult | null;
    notice?: AgentNotice | null;
    onsend: (message: string) => void;
    oncancel?: () => void;
    onnavigate?: (name: string) => void;
  }

  let {
    agent,
    messages,
    result = null,
    notice = null,
    onsend,
    oncancel,
    onnavigate,
  }: Props = $props();

  let isExhausted = $derived(agent?.status === "exhausted");
  let isBusy = $derived(agent?.status === "thinking" || agent?.status === "running");
  let canCancel = $derived(Boolean(agent?.activeProcessId && oncancel));
  let scopeLabel = $derived.by(() => {
    const raw = agent?.writableRoot ?? ".";
    if (!raw || raw === "." || raw === "./") return "repo root";
    return raw;
  });
  let composerDisabled = $derived(Boolean(isExhausted || notice?.blocking));
  let composerPlaceholder = $derived.by(() => {
    if (notice?.blocking) return notice.title;
    if (isExhausted) return "Agent exhausted";
    if (agent?.status === "idle" && messages.length === 0) return "Start the first task...";
    return "Describe the next task...";
  });
</script>

{#if agent}
  <div class="agent-detail-pane">
    <div class="agent-detail-header">
      <div class="agent-detail-header-left">
        <StatusDot status={agent.status} size={7} />
        <span class="agent-detail-name">{agent.name}</span>
        <span class="agent-detail-status" style:color={STATUS_COLORS[agent.status]}>
          {STATUS_LABELS[agent.status]}
        </span>
      </div>
      <div class="agent-detail-header-right">
        <span class="agent-detail-tag">{agent.harnessId}</span>
        <span class="agent-detail-tag">{agent.model}</span>
        <span class="agent-detail-tag">scope {scopeLabel}</span>
        {#if agent.tokens > 0}
          <span class="agent-detail-tokens">{agent.tokens.toLocaleString()}t</span>
        {/if}
        {#if canCancel}
          <button class="agent-detail-cancel" onclick={oncancel}>cancel</button>
        {/if}
      </div>
    </div>

    <div class="agent-detail-body">
      {#if notice}
        <div class={`agent-detail-notice agent-detail-notice-${notice.tone}`}>
          <div class="agent-detail-notice-title">{notice.title}</div>
          <div>{notice.message}</div>
        </div>
      {:else if agent.status === "idle" && messages.length === 0}
        <div class="agent-detail-notice agent-detail-notice-info">
          <div class="agent-detail-notice-title">Ready</div>
          <div>This agent is ready for its first task.</div>
        </div>
      {/if}

      {#if isExhausted}
        <div class="agent-detail-readonly">
          This agent is exhausted. Its history remains visible, but it is read-only for now.
        </div>
      {/if}

      {#if result}
        <div class="agent-result-card">
          <div class="agent-result-header">
            <span class="agent-result-title">latest result</span>
            <span class={`agent-result-status agent-result-status-${result.status}`}>{result.status}</span>
          </div>

          <div class="agent-result-summary">{result.summary}</div>

          {#if result.commands.length > 0}
            <div class="agent-result-meta">
              <strong>commands</strong>
              <ol class="agent-result-command-list">
                {#each result.commands as command}
                  <li>
                    <code>{command.command}</code>
                    {#if command.exitCode !== null}
                      <span class="agent-result-exit">exit {command.exitCode}</span>
                    {/if}
                  </li>
                {/each}
              </ol>
            </div>
          {/if}

          {#if result.filesTouched.length > 0}
            <div class="agent-result-meta">
              <strong>files</strong>
              <span>{result.filesTouched.join(", ")}</span>
            </div>
          {/if}

          {#if result.violations.length > 0}
            <div class="agent-result-meta">
              <strong>violations</strong>
              <span>{result.violations.join(", ")}</span>
            </div>
          {/if}

          {#if result.diffSummary}
            <div class="agent-result-meta">
              <strong>diff</strong>
              <span>{result.diffSummary}</span>
            </div>
          {/if}

          {#if result.commit}
            <div class="agent-result-meta">
              <strong>commit</strong>
              <span>{result.commit.sha} · {result.commit.message}</span>
            </div>
          {/if}
        </div>
      {/if}

      <TaskTranscript {messages} status={agent.status} {onnavigate} />
    </div>

    <TaskComposer
      {onsend}
      disabled={composerDisabled}
      placeholder={composerPlaceholder}
      actionLabel="Run task"
    />
  </div>
{:else}
  <div class="agent-detail-empty">
    <span>Select an agent</span>
  </div>
{/if}

<style>
  .agent-detail-pane {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .agent-detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    padding: 8px 16px;
    border-bottom: 1px solid var(--b1);
  }

  .agent-detail-header-left,
  .agent-detail-header-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .agent-detail-name {
    font-family: var(--m);
    font-size: 13px;
    font-weight: 600;
    color: var(--t1);
  }

  .agent-detail-status {
    font-family: var(--m);
    font-size: 10px;
  }

  .agent-detail-tag {
    border: 1px solid var(--b1);
    border-radius: 3px;
    background: var(--bg3);
    padding: 2px 7px;
    font-family: var(--m);
    font-size: 9px;
    color: var(--t5);
  }

  .agent-detail-tokens {
    font-family: var(--m);
    font-size: 9px;
    color: var(--t6);
  }

  .agent-detail-cancel {
    border: 1px solid color-mix(in srgb, #ef4444 35%, var(--b1));
    border-radius: 999px;
    background: color-mix(in srgb, #ef4444 10%, transparent);
    padding: 3px 8px;
    font-family: var(--m);
    font-size: 10px;
    color: #dc2626;
    cursor: pointer;
  }

  .agent-detail-cancel:hover {
    background: color-mix(in srgb, #ef4444 16%, transparent);
  }

  .agent-detail-body {
    display: flex;
    flex: 1;
    min-height: 0;
    flex-direction: column;
    overflow: hidden;
  }

  .agent-detail-empty {
    display: flex;
    height: 100%;
    align-items: center;
    justify-content: center;
    font-family: var(--m);
    font-size: 12px;
    color: var(--t6);
  }

  .agent-detail-readonly {
    padding: 10px 16px;
    border-bottom: 1px solid var(--b1);
    background: color-mix(in srgb, #fb923c 10%, transparent);
    font-family: var(--m);
    font-size: 11px;
    color: #fb923c;
  }

  .agent-detail-notice {
    margin: 12px 16px 0;
    border: 1px solid var(--b1);
    border-radius: 10px;
    padding: 10px 12px;
    font-family: var(--m);
    font-size: 11px;
    line-height: 1.5;
  }

  .agent-detail-notice-title {
    margin-bottom: 4px;
    font-weight: 600;
  }

  .agent-detail-notice-info {
    color: var(--t3);
    background: color-mix(in srgb, var(--accent) 7%, transparent);
  }

  .agent-detail-notice-warning {
    color: #b45309;
    background: color-mix(in srgb, #f59e0b 12%, transparent);
  }

  .agent-detail-notice-error {
    color: #dc2626;
    background: color-mix(in srgb, #ef4444 10%, transparent);
  }

  .agent-detail-notice-success {
    color: #15803d;
    background: color-mix(in srgb, #22c55e 10%, transparent);
  }

  .agent-result-card {
    margin: 12px 16px 0;
    border: 1px solid var(--b1);
    border-radius: 10px;
    background: var(--bg2);
    padding: 10px 12px;
    font-family: var(--m);
    font-size: 11px;
    line-height: 1.5;
  }

  .agent-result-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }

  .agent-result-title {
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--t5);
  }

  .agent-result-status {
    font-size: 10px;
    font-weight: 600;
  }

  .agent-result-status-success {
    color: #15803d;
  }

  .agent-result-status-error,
  .agent-result-status-policy_error {
    color: #dc2626;
  }

  .agent-result-status-aborted {
    color: #b45309;
  }

  .agent-result-summary {
    color: var(--t2);
  }

  .agent-result-meta {
    display: grid;
    gap: 2px;
    margin-top: 8px;
  }

  .agent-result-command-list {
    display: grid;
    gap: 3px;
    padding-left: 16px;
    margin: 0;
  }

  .agent-result-exit {
    margin-left: 8px;
    color: var(--t5);
  }

  @media (max-width: 900px) {
    .agent-detail-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
    }

    .agent-detail-header-left,
    .agent-detail-header-right {
      width: 100%;
      flex-wrap: wrap;
    }

    .agent-detail-header-right {
      justify-content: flex-start;
    }

    .agent-detail-notice,
    .agent-result-card {
      margin-left: 12px;
      margin-right: 12px;
    }

    .agent-detail-readonly {
      padding-left: 12px;
      padding-right: 12px;
    }
  }

  @media (max-width: 640px) {
    .agent-detail-name {
      font-size: 12px;
    }

    .agent-detail-tag,
    .agent-detail-tokens,
    .agent-detail-status,
    .agent-detail-cancel {
      font-size: 10px;
    }
  }
</style>
