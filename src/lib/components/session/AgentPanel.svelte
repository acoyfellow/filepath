<script lang="ts">
  import StatusDot from "$lib/components/shared/StatusDot.svelte";
  import { STATUS_COLORS, STATUS_LABELS } from "$lib/protocol";
  import type { ArtifactEntry, AgentNode } from "$lib/types/session";
  import ChatInput from "./ChatInput.svelte";
  import type { ChatMsg } from "./ChatView.svelte";
  import ChatView from "./ChatView.svelte";

  interface Props {
    agent: AgentNode | null;
    messages: ChatMsg[];
    onsend: (message: string) => void;
    onnavigate?: (name: string) => void;
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
    artifactError = "";
    targetThreadId = threads.find((thread) => thread.id !== agent.id)?.id ?? "";
  }

  async function submitArtifactTransfer() {
    if (!agent || !onsendartifact) return;
    if (!sourcePath.trim() || !targetPath.trim() || !targetThreadId) {
      artifactError = "Source path, target thread, and target path are required.";
      return;
    }
    if (targetThreadId === agent.id) {
      artifactError = "Choose a different target thread.";
      return;
    }

    artifactError = "";
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
      <ChatView
        {messages}
        status={agent.status}
        {onnavigate}
      />
    </div>

    <div class="artifact-section">
      <div class="artifact-row">
        <div class="artifact-label">Artifacts</div>
        <button class="artifact-action" onclick={openArtifactModal}>Send file</button>
      </div>

      {#if artifacts.length > 0}
        <div class="artifact-list">
          {#each artifacts as artifact}
            <div class="artifact-item">
              <div class="artifact-main">
                <span class="artifact-path">{artifact.sourcePath}</span>
                <span class="artifact-arrow">-&gt;</span>
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

    <ChatInput {onsend} />
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
        <button
          type="button"
          class="artifact-cancel"
          onclick={() => {
            showArtifactModal = false;
          }}
        >
          Cancel
        </button>
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

  .panel-left,
  .panel-right,
  .artifact-row {
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

  .artifact-section {
    border-top: 1px solid var(--b1);
    padding: 10px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .artifact-row {
    justify-content: space-between;
  }

  .artifact-label {
    font-family: var(--m);
    font-size: 10px;
    color: var(--t5);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .artifact-action,
  .artifact-cancel,
  .artifact-confirm {
    border-radius: 8px;
    padding: 7px 10px;
    font-family: var(--m);
    font-size: 10px;
    cursor: pointer;
  }

  .artifact-action {
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    background: color-mix(in srgb, var(--accent) 14%, var(--bg));
    color: var(--t2);
  }

  .artifact-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .artifact-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-family: var(--m);
    font-size: 10px;
  }

  .artifact-main {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .artifact-path {
    color: var(--t3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .artifact-arrow {
    color: var(--t6);
  }

  .artifact-status {
    color: var(--t5);
    text-transform: uppercase;
  }

  .artifact-status[data-status="delivered"] {
    color: #22c55e;
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

  .artifact-error,
  .artifact-modal-error {
    color: #ef4444;
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

  .artifact-modal-overlay {
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--bg) 72%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    z-index: 20;
  }

  .artifact-modal {
    width: min(320px, 100%);
    border: 1px solid var(--b1);
    background: var(--bg);
    border-radius: 12px;
    padding: 14px;
    box-shadow: 0 20px 50px color-mix(in srgb, black 14%, transparent);
    display: flex;
    flex-direction: column;
    gap: 10px;
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

  .artifact-field select,
  .artifact-field input {
    width: 100%;
    border: 1px solid var(--b1);
    border-radius: 8px;
    background: var(--bg2);
    color: var(--t2);
    padding: 8px 10px;
    font: inherit;
  }

  .artifact-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
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
</style>
