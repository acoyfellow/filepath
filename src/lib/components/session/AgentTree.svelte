<script lang="ts">
  import { onMount } from "svelte";
  import { alert, confirm } from "$lib/components/alert";
  import TreeNode from "./TreeNode.svelte";
  import type { AgentNode } from "$lib/types/session";
  import * as Dialog from "$lib/components/ui/dialog";
  import Button from "$lib/components/ui/button/button.svelte";

  interface Props {
    root: AgentNode | null;
    selectedId: string | null;
    width?: number;
    onselect: (id: string) => void;
    onmove: (payload: { nodeId: string; parentId: string | null; sortOrder: number }) => Promise<void>;
    onrename: (payload: { nodeId: string; name: string }) => Promise<void>;
    ondelete: (nodeId: string) => Promise<void>;
    onspawn: () => void;
  }

  let {
    root,
    selectedId,
    width = 220,
    onselect,
    onmove,
    onrename,
    ondelete,
    onspawn,
  }: Props = $props();

  let dragging = $state(false);
  let treeWidth = $state(220);
  let dialogNodeId = $state<string | null>(null);
  let dialogMode = $state<"move" | "rename" | null>(null);
  let moveTargetParentId = $state("");
  let moveTargetSortOrder = $state("0");
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

  function handleToggle(_id: string) {}

  function flattenNodes(node: AgentNode | null): AgentNode[] {
    if (!node) return [];
    const collected: AgentNode[] = [];
    const visit = (current: AgentNode) => {
      collected.push(current);
      for (const child of current.children) visit(child);
    };
    visit(node);
    return collected;
  }

  const flatNodes = $derived(flattenNodes(root));
  const dialogNode = $derived(
    dialogNodeId ? flatNodes.find((node) => node.id === dialogNodeId) ?? null : null,
  );

  const blockedMoveParentIds = $derived.by(() => {
    if (!dialogNode) return new Set<string>();
    const blocked = new Set<string>([dialogNode.id]);
    const visit = (node: AgentNode) => {
      for (const child of node.children) {
        blocked.add(child.id);
        visit(child);
      }
    };
    visit(dialogNode);
    return blocked;
  });

  function closeDialog() {
    dialogNodeId = null;
    dialogMode = null;
    moveTargetParentId = "";
    moveTargetSortOrder = "0";
    renameValue = "";
    dialogError = "";
    dialogSubmitting = false;
  }

  function openDialog(payload: { nodeId: string; action: "move" | "rename" | "delete" }) {
    if (payload.action === "delete") {
      void confirmDelete(payload.nodeId);
      return;
    }

    dialogNodeId = payload.nodeId;
    dialogMode = payload.action;
    moveTargetParentId = "";
    moveTargetSortOrder = "0";
    renameValue = flatNodes.find((node) => node.id === payload.nodeId)?.name ?? "";
    dialogError = "";
  }

  async function confirmDelete(nodeId: string) {
    const confirmed = await confirm("Delete this + all children?");
    if (!confirmed) return;

    try {
      await ondelete(nodeId);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to delete agent", "error");
    }
  }

  async function submitDialog() {
    if (!dialogNodeId || !dialogMode) return;
    dialogSubmitting = true;
    dialogError = "";

    try {
      if (dialogMode === "move") {
        const sortOrder = Number.parseInt(moveTargetSortOrder, 10);
        await onmove({
          nodeId: dialogNodeId,
          parentId: moveTargetParentId || null,
          sortOrder: Number.isFinite(sortOrder) ? Math.max(0, sortOrder) : 0,
        });
      } else {
        const name = renameValue.trim();
        if (!name) {
          throw new Error("Name is required");
        }
        await onrename({ nodeId: dialogNodeId, name });
      }

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
    <div class="tree-header">agents</div>
    <div class="tree-scroll" role="tree">
      {#if root}
        <TreeNode
          node={root}
          {selectedId}
          {onselect}
          {onmove}
          onrequestaction={openDialog}
          ontoggle={handleToggle}
        />
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
  open={Boolean(dialogNodeId && dialogMode)}
  onOpenChange={(open) => {
    if (!open) closeDialog();
  }}
>
  <Dialog.Content class="dialog-shell border-border bg-background text-foreground max-w-md">
    <Dialog.Header>
      <Dialog.Title class="dialog-title">
        {dialogMode === "move" ? "Move agent" : "Rename agent"}
      </Dialog.Title>
      <Dialog.Description class="dialog-description">
        {#if dialogMode === "move" && dialogNode}
          Choose where to place <strong>{dialogNode.name}</strong> in the tree.
        {:else if dialogMode === "rename" && dialogNode}
          Update the display name for <strong>{dialogNode.name}</strong>.
        {/if}
      </Dialog.Description>
    </Dialog.Header>

    {#if dialogMode === "move"}
      <label class="dialog-field">
        <span>Destination parent</span>
        <select bind:value={moveTargetParentId}>
          <option value="">Root</option>
          {#each flatNodes.filter((node) => !blockedMoveParentIds.has(node.id)) as node}
            <option value={node.id}>{node.name}</option>
          {/each}
        </select>
      </label>
      <label class="dialog-field">
        <span>Sort order</span>
        <input bind:value={moveTargetSortOrder} type="number" min="0" step="1" />
      </label>
    {:else if dialogMode === "rename"}
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
        {#if dialogMode === "move"}
          {dialogSubmitting ? "Moving..." : "Move"}
        {:else}
          {dialogSubmitting ? "Saving..." : "Rename"}
        {/if}
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
  .dialog-field select,
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
