<script lang="ts">
  import StatusDot from "$lib/components/shared/StatusDot.svelte";
  import ChatView from "./ChatView.svelte";
  import ChatInput from "./ChatInput.svelte";
  import { STATUS_COLORS, STATUS_LABELS } from "$lib/protocol";
  import type { AgentNode, ArtifactEntry, ProcessEntry } from "$lib/types/session";
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
    artifacts?: ArtifactEntry[];
    threads?: Array<{ id: string; name: string }>;
    onsendartifact?: (payload: {
      sourceNodeId: string;
      sourcePath: string;
      targetNodeId: string;
      targetPath: string;
    }) => Promise<void>;
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
    artifacts = [],
    threads = [],
    onsendartifact,
  }: Props = $props();

  let showArtifactModal = $state(false);
  let sourcePath = $state("");
  let targetThreadId = $state("");
  let targetPath = $state("");
  let artifactError = $state("");
  let sendingArtifact = $state(false);

  function openArtifactModal() {
    if (!agent) return;
    showArtifactModal = true;
    sourcePath = "";
    targetPath = "";
    targetThreadId = threads.find((thread) => thread.id !== agent.id)?.id ?? "";
    artifactError = "";
  }

  async function submitArtifactTransfer() {
    if (!agent || !onsendartifact) return;
    artifactError = "";

    if (!sourcePath.trim() || !targetPath.trim() || !targetThreadId) {
      artifactError = "Source path, target thread, and target path are required.";
      return;
    }
    if (targetThreadId === agent.id) {
      artifactError = "Choose a different target thread.";
      return;
    }

    sendingArtifact = true;
    try {
      await onsendartifact({
        sourceNodeId: agent.id,
        sourcePath: sourcePath.trim(),
        targetNodeId: targetThreadId,
        targetPath: targetPath.trim(),
      });
      showArtifactModal = false;
    } catch (error) {
      artifactError = error instanceof Error ? error.message : "Artifact transfer failed";
    } finally {
      sendingArtifact = false;
    }
  }

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
      <div class="process-secondary-row">
        <button class="process-secondary-action" onclick={openArtifactModal}>Send File To...</button>
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
    <div class="artifact-section">
      <div class="artifact-label">Artifacts</div>
      {#if artifacts.length > 0}
        <div class="artifact-list">
          {#each artifacts as artifact}
            <div class="artifact-row">
              <div class="artifact-main">
                <span class="artifact-path">{artifact.sourcePath}</span>
                <span class="artifact-arrow">→</span>
                <span class="artifact-path">{artifact.targetPath}</span>
              </div>
              <span class="artifact-status" data-status={artifact.status}>{artifact.status}</span>
            </div>
            {#if artifact.errorMessage}
              <div class="artifact-error">{artifact.errorMessage}</div>
            {/if}
          {/each}
        </div>
      {:else}
        <div class="artifact-empty">No file handoffs for this thread yet.</div>
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

{#if showArtifactModal && agent}
  <div class="artifact-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="artifact-transfer-title">
    <div class="artifact-modal">
      <div class="artifact-modal-title" id="artifact-transfer-title">Send file to another thread</div>
      <label class="artifact-field">
        <span>Source path</span>
        <input bind:value={sourcePath} placeholder="dist/output.json" />
      </label>
      <label class="artifact-field">
        <span>Target thread</span>
        <select bind:value={targetThreadId}>
          <option value="">Select thread</option>
          {#each threads.filter((thread) => thread.id !== agent.id) as thread}
            <option value={thread.id}>{thread.name}</option>
          {/each}
        </select>
      </label>
      <label class="artifact-field">
        <span>Target path</span>
        <input bind:value={targetPath} placeholder="handoffs/output.json" />
      </label>
      {#if artifactError}
        <div class="artifact-modal-error">{artifactError}</div>
      {/if}
      <div class="artifact-modal-actions">
        <button type="button" class="artifact-cancel" onclick={() => { showArtifactModal = false; }}>Cancel</button>
        <button type="button" class="artifact-confirm" disabled={sendingArtifact} onclick={submitArtifactTransfer}>
          {sendingArtifact ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
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
  .process-secondary-row {
    display: flex;
    justify-content: flex-end;
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
  .process-secondary-action {
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
  .artifact-section {
    border-top: 1px solid var(--b1);
    padding: 8px 16px 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .artifact-label {
    font-family: var(--m);
    font-size: 10px;
    color: var(--t5);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .artifact-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .artifact-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    font-family: var(--m);
    font-size: 10px;
    color: var(--t3);
  }
  .artifact-main {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .artifact-path {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .artifact-arrow {
    color: var(--t5);
  }
  .artifact-status {
    text-transform: uppercase;
    font-size: 9px;
    color: var(--t5);
  }
  .artifact-status[data-status="delivered"] {
    color: #16a34a;
  }
  .artifact-status[data-status="failed"] {
    color: #ef4444;
  }
  .artifact-error,
  .artifact-empty {
    font-family: var(--m);
    font-size: 10px;
    color: var(--t5);
  }
  .artifact-modal-overlay {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, black 32%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    z-index: 50;
  }
  .artifact-modal {
    width: min(360px, 100%);
    border: 1px solid var(--b1);
    border-radius: 14px;
    background: var(--bg);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: 0 24px 60px color-mix(in srgb, black 18%, transparent);
  }
  .artifact-modal-title {
    font-family: var(--m);
    font-size: 12px;
    color: var(--t2);
    font-weight: 600;
  }
  .artifact-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-family: var(--m);
    font-size: 10px;
    color: var(--t4);
  }
  .artifact-field input,
  .artifact-field select {
    width: 100%;
    border: 1px solid var(--b1);
    border-radius: 8px;
    background: var(--bg2);
    color: var(--t2);
    padding: 8px 10px;
    font: inherit;
  }
  .artifact-modal-error {
    font-family: var(--m);
    font-size: 10px;
    color: #ef4444;
  }
  .artifact-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .artifact-cancel,
  .artifact-confirm {
    border-radius: 8px;
    padding: 7px 10px;
    font-family: var(--m);
    font-size: 10px;
    cursor: pointer;
  }
  .artifact-cancel {
    border: 1px solid var(--b1);
    background: var(--bg2);
    color: var(--t3);
  }
  .artifact-confirm {
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    background: color-mix(in srgb, var(--accent) 14%, var(--bg));
    color: var(--t2);
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
