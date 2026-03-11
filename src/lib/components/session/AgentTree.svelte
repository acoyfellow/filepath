<script lang="ts">
  import { onMount } from "svelte";
  import { alert, confirm } from "$lib/components/alert";
  import TreeNode from "./TreeNode.svelte";
  import type { AgentRecord } from "$lib/types/workspace";
  import * as Dialog from "$lib/components/ui/dialog";
  import Button from "$lib/components/ui/button/button.svelte";

  interface Props {
    agents: AgentRecord[];
    selectedId: string | null;
    isRefreshing?: boolean;
    width?: number;
    onselect: (id: string) => void;
    onrename: (payload: { agentId: string; name: string }) => Promise<void>;
    ondelete: (agentId: string) => Promise<void>;
    onspawn: () => void;
  }

  let {
    agents,
    selectedId,
    isRefreshing = false,
    width = 220,
    onselect,
    onrename,
    ondelete,
    onspawn,
  }: Props = $props();

  let dragging = $state(false);
  let treeWidth = $state(220);
  let dialogAgentId = $state<string | null>(null);
  let dialogMode = $state<"rename" | null>(null);
  let renameValue = $state("");
  let dialogError = $state("");
  let dialogSubmitting = $state(false);

  onMount(() => {
    treeWidth = width;
  });

  function onMouseDown() {
    dragging = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function onMouseMove(e: MouseEvent) {
    if (dragging) {
      treeWidth = Math.max(150, Math.min(360, e.clientX));
    }
  }

  function onMouseUp() {
    if (dragging) {
      dragging = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  }

  const flatNodes = $derived(
    [...agents].sort((left, right) => right.updatedAt - left.updatedAt),
  );
  const dialogNode = $derived(
    dialogAgentId ? flatNodes.find((node) => node.id === dialogAgentId) ?? null : null,
  );

  function closeDialog() {
    dialogAgentId = null;
    dialogMode = null;
    renameValue = "";
    dialogError = "";
    dialogSubmitting = false;
  }

  function openDialog(payload: { agentId: string; action: "rename" | "delete" }) {
    if (payload.action === "delete") {
      void confirmDelete(payload.agentId);
      return;
    }

    dialogAgentId = payload.agentId;
    dialogMode = "rename";
    renameValue = flatNodes.find((node) => node.id === payload.agentId)?.name ?? "";
    dialogError = "";
  }

  async function confirmDelete(agentId: string) {
    const confirmed = await confirm("Delete this agent?");
    if (!confirmed) return;

    try {
      await ondelete(agentId);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to delete agent", "error");
    }
  }

  async function submitDialog() {
    if (!dialogAgentId || !dialogMode) return;
    dialogSubmitting = true;
    dialogError = "";

    try {
      const name = renameValue.trim();
      if (!name) {
        throw new Error("Name is required");
      }

      await onrename({ agentId: dialogAgentId, name });

      closeDialog();
    } catch (error) {
      dialogError = error instanceof Error ? error.message : "Unable to update agent";
    } finally {
      dialogSubmitting = false;
    }
  }
</script>

<svelte:window onmousemove={onMouseMove} onmouseup={onMouseUp} />

<div class="tree-container">
  <div class="tree" style:width="{treeWidth}px">
    <div class="tree-header">
      agents
      {#if isRefreshing}
        <span class="tree-header-spinner" aria-hidden="true"></span>
      {/if}
    </div>
    <div class="tree-scroll" role="tree">
      {#if flatNodes.length > 0}
        {#each flatNodes as node (node.id)}
          <TreeNode
            {node}
            {selectedId}
            {onselect}
            onrequestaction={openDialog}
          />
        {/each}
      {:else}
        <div class="tree-empty">No agents yet</div>
      {/if}
    </div>
    <div class="tree-footer">
      <button class="tree-spawn" onclick={onspawn}>
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
          <path d="M6 2v8M2 6h8" />
        </svg>
        new agent
      </button>
    </div>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="resize-handle" onmousedown={onMouseDown}></div>
</div>

<Dialog.Root
  open={Boolean(dialogAgentId && dialogMode)}
  onOpenChange={(open) => {
    if (!open) closeDialog();
  }}
>
  <Dialog.Content class="dialog-shell border-border bg-background text-foreground max-w-md">
    <Dialog.Header>
      <Dialog.Title class="dialog-title">
        Rename agent
      </Dialog.Title>
      <Dialog.Description class="dialog-description">
        {#if dialogMode === "rename" && dialogNode}
          Update the display name for <strong>{dialogNode.name}</strong>.
        {/if}
      </Dialog.Description>
    </Dialog.Header>

    {#if dialogMode === "rename"}
      <label class="dialog-field">
        <span>Name</span>
        <input bind:value={renameValue} type="text" maxlength="120" />
      </label>
    {/if}

    {#if dialogError}
      <div class="dialog-error">{dialogError}</div>
    {/if}

    <Dialog.Footer class="dialog-actions">
      <Button variant="outline" onclick={closeDialog}>
        Cancel
      </Button>
      <Button disabled={dialogSubmitting} onclick={submitDialog}>
        {dialogSubmitting ? "Saving..." : "Rename"}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<style>
  .tree-container {
    display: flex;
    flex-shrink: 0;
    position: relative;
  }
  .tree {
    display: flex;
    flex-direction: column;
    background: var(--tree-bg);
    border-right: 1px solid var(--b1);
    flex-shrink: 0;
  }
  .tree-header {
    padding: 6px 12px;
    border-bottom: 1px solid var(--b1);
    font-family: var(--m);
    font-size: 9px;
    color: var(--t5);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .tree-header-spinner {
    width: 10px;
    height: 10px;
    border: 2px solid var(--b2);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: tree-spin 0.6s linear infinite;
  }
  @keyframes tree-spin {
    to { transform: rotate(360deg); }
  }
  .tree-scroll {
    flex: 1;
    overflow: auto;
    padding: 2px 0;
  }
  .tree-empty {
    padding: 16px 12px;
    font-family: var(--m);
    font-size: 11px;
    color: var(--t5);
  }
  .tree-footer {
    padding: 4px 8px;
    border-top: 1px solid var(--b1);
  }
  .tree-spawn {
    width: 100%;
    background: none;
    border: 1px dashed var(--b2);
    color: var(--t5);
    font-family: var(--m);
    font-size: 10px;
    padding: 5px 0;
    border-radius: 5px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    transition: all 0.1s;
  }
  .tree-spawn:hover {
    border-color: color-mix(in srgb, var(--accent) 40%, transparent);
    color: var(--accent);
  }
  .resize-handle {
    width: 3px;
    cursor: col-resize;
    background: transparent;
    flex-shrink: 0;
    z-index: 10;
    transition: background 0.1s;
  }
  .resize-handle:hover {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }
  :global(.dialog-shell) {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  :global(.dialog-title) {
    font-family: var(--m);
    font-size: 14px;
    font-weight: 600;
  }
  :global(.dialog-description) {
    font-family: var(--m);
    font-size: 11px;
    color: var(--t5);
    line-height: 1.5;
  }
  .dialog-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-family: var(--m);
    font-size: 10px;
    color: var(--t4);
  }
  .dialog-field input {
    width: 100%;
    border: 1px solid var(--b1);
    border-radius: 8px;
    background: var(--bg2);
    color: var(--t2);
    padding: 8px 10px;
    font: inherit;
  }
  .dialog-error {
    font-family: var(--m);
    font-size: 10px;
    color: #ef4444;
  }
  :global(.dialog-actions) {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
