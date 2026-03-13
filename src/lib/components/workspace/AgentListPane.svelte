<script lang="ts">
  import { alert, confirm } from "$lib/components/alert";
  import AgentListItem from "./AgentListItem.svelte";
  import type { AgentRecord } from "$lib/types/workspace";
  import * as Dialog from "$lib/components/ui/dialog";
  import Button from "$lib/components/ui/button/button.svelte";

  interface Props {
    agents: AgentRecord[];
    selectedId: string | null;
    isRefreshing?: boolean;
    onselect: (id: string) => void;
    onrename: (payload: { agentId: string; name: string }) => Promise<void>;
    ondelete: (agentId: string) => Promise<void>;
    oncreate: () => void;
  }

  let {
    agents,
    selectedId,
    isRefreshing = false,
    onselect,
    onrename,
    ondelete,
    oncreate,
  }: Props = $props();

  let dialogAgentId = $state<string | null>(null);
  let renameValue = $state("");
  let dialogError = $state("");
  let dialogSubmitting = $state(false);

  const sortedAgents = $derived(
    [...agents].sort((left, right) => right.updatedAt - left.updatedAt),
  );
  const dialogAgent = $derived(
    dialogAgentId ? sortedAgents.find((agent) => agent.id === dialogAgentId) ?? null : null,
  );

  function closeDialog() {
    dialogAgentId = null;
    renameValue = "";
    dialogError = "";
    dialogSubmitting = false;
  }

  function openRename(agentId: string) {
    dialogAgentId = agentId;
    renameValue = sortedAgents.find((agent) => agent.id === agentId)?.name ?? "";
    dialogError = "";
  }

  async function confirmDelete(agentId: string) {
    const accepted = await confirm("Delete this agent?");
    if (!accepted) return;

    try {
      await ondelete(agentId);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to delete agent", "error");
    }
  }

  async function handleAction(payload: { agentId: string; action: "rename" | "delete" }) {
    if (payload.action === "delete") {
      await confirmDelete(payload.agentId);
      return;
    }

    openRename(payload.agentId);
  }

  async function submitRename() {
    if (!dialogAgentId) return;
    dialogSubmitting = true;
    dialogError = "";

    try {
      const name = renameValue.trim();
      if (!name) throw new Error("Name is required");
      await onrename({ agentId: dialogAgentId, name });
      closeDialog();
    } catch (error) {
      dialogError = error instanceof Error ? error.message : "Unable to rename agent";
    } finally {
      dialogSubmitting = false;
    }
  }
</script>

<aside class="agent-list-pane">
  <div class="agent-list-header">
    <span>agents</span>
    {#if isRefreshing}
      <span class="agent-list-spinner" aria-hidden="true"></span>
    {/if}
  </div>

  <div class="agent-list-scroll">
    {#if sortedAgents.length > 0}
      {#each sortedAgents as agent (agent.id)}
        <AgentListItem
          {agent}
          {selectedId}
          {onselect}
          onrequestaction={handleAction}
        />
      {/each}
    {:else}
      <div class="agent-list-empty">No agents yet</div>
    {/if}
  </div>

  <div class="agent-list-footer">
    <button class="agent-create-button" onclick={oncreate}>
      <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
        <path d="M6 2v8M2 6h8" />
      </svg>
      new agent
    </button>
  </div>
</aside>

<Dialog.Root
  open={Boolean(dialogAgentId)}
  onOpenChange={(open) => {
    if (!open) closeDialog();
  }}
>
  <Dialog.Content class="dialog-shell border-border bg-background text-foreground max-w-md">
    <Dialog.Header>
      <Dialog.Title class="dialog-title">Rename agent</Dialog.Title>
      <Dialog.Description class="dialog-description">
        {#if dialogAgent}
          Update the display name for <strong>{dialogAgent.name}</strong>.
        {/if}
      </Dialog.Description>
    </Dialog.Header>

    <label class="dialog-field">
      <span>Name</span>
      <input bind:value={renameValue} type="text" maxlength="120" />
    </label>

    {#if dialogError}
      <div class="dialog-error">{dialogError}</div>
    {/if}

    <Dialog.Footer class="dialog-actions">
      <Button variant="outline" onclick={closeDialog}>Cancel</Button>
      <Button disabled={dialogSubmitting} onclick={submitRename}>
        {dialogSubmitting ? "Saving..." : "Rename"}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<style>
  .agent-list-pane {
    display: flex;
    flex-shrink: 0;
    width: 260px;
    flex-direction: column;
    border-right: 1px solid var(--b1);
    background: var(--bg);
    min-height: 0;
  }

  .agent-list-header {
    display: flex;
    align-items: center;
    gap: 6px;
    border-bottom: 1px solid var(--b1);
    padding: 6px 12px;
    font-family: var(--m);
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--t5);
  }

  .agent-list-spinner {
    width: 10px;
    height: 10px;
    border: 2px solid var(--b2);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: agent-list-spin 0.6s linear infinite;
  }

  @keyframes agent-list-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .agent-list-scroll {
    flex: 1;
    overflow: auto;
    padding: 2px 0;
    min-height: 0;
  }

  .agent-list-empty {
    padding: 16px 12px;
    font-family: var(--m);
    font-size: 11px;
    color: var(--t5);
  }

  .agent-list-footer {
    border-top: 1px solid var(--b1);
    padding: 4px 8px;
  }

  .agent-create-button {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: 1px dashed var(--b2);
    border-radius: 5px;
    background: none;
    padding: 5px 0;
    font-family: var(--m);
    font-size: 10px;
    color: var(--t5);
  }

  .agent-create-button:hover {
    border-color: var(--t5);
    color: var(--t3);
  }

  @media (max-width: 900px) {
    .agent-list-pane {
      width: 100%;
      border-right: none;
      border-bottom: 1px solid var(--b1);
      max-height: 34vh;
    }

    .agent-list-scroll {
      max-height: 26vh;
    }
  }

  @media (max-width: 640px) {
    .agent-list-header {
      padding: 8px 12px;
      font-size: 10px;
    }

    .agent-list-footer {
      padding: 8px 12px 10px;
    }

    .agent-create-button {
      min-height: 38px;
      font-size: 11px;
    }
  }
</style>
