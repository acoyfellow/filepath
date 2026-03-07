<script lang="ts">
  import { onMount } from "svelte";
  import TreeNode from "./TreeNode.svelte";
  import type { AgentNode } from "$lib/types/session";

  interface Props {
    root: AgentNode | null;
    selectedId: string | null;
    width?: number;
    onselect: (id: string) => void;
    onmove: (payload: { nodeId: string; parentId: string | null; sortOrder: number }) => Promise<void>;
    onspawn: () => void;
  }

  let { root, selectedId, width = 220, onselect, onmove, onspawn }: Props = $props();

  // Resize state
  let dragging = $state(false);
  let treeWidth = $state(220);

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

  // Noop for toggle -- TreeNode manages its own collapsed state internally
  function handleToggle(_id: string) {}

  let moveDialogNodeId = $state<string | null>(null);
  let moveTargetParentId = $state<string>("");
  let moveTargetSortOrder = $state("0");
  let moveDialogError = $state("");
  let moveSubmitting = $state(false);

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

  let flatNodes = $derived(flattenNodes(root));

  function openMoveDialog(nodeId: string) {
    moveDialogNodeId = nodeId;
    moveTargetParentId = "";
    moveTargetSortOrder = "0";
    moveDialogError = "";
  }

  async function submitMoveDialog() {
    if (!moveDialogNodeId) return;
    moveSubmitting = true;
    moveDialogError = "";
    try {
      const sortOrder = Number.parseInt(moveTargetSortOrder, 10);
      await onmove({
        nodeId: moveDialogNodeId,
        parentId: moveTargetParentId || null,
        sortOrder: Number.isFinite(sortOrder) ? Math.max(0, sortOrder) : 0,
      });
      moveDialogNodeId = null;
    } catch (error) {
      moveDialogError = error instanceof Error ? error.message : "Unable to move thread";
    } finally {
      moveSubmitting = false;
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
          onrequestmove={openMoveDialog}
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

{#if moveDialogNodeId}
  <div class="move-overlay" role="dialog" aria-modal="true" aria-labelledby="move-agent-title">
    <div class="move-sheet">
      <div class="move-title" id="move-agent-title">Move agent</div>
      <label class="move-field">
        <span>Destination parent</span>
        <select bind:value={moveTargetParentId}>
          <option value="">Root</option>
          {#each flatNodes.filter((node) => node.id !== moveDialogNodeId) as node}
            <option value={node.id}>{node.name}</option>
          {/each}
        </select>
      </label>
      <label class="move-field">
        <span>Sort order</span>
        <input bind:value={moveTargetSortOrder} type="number" min="0" step="1" />
      </label>
      {#if moveDialogError}
        <div class="move-error">{moveDialogError}</div>
      {/if}
      <div class="move-actions">
        <button type="button" class="move-cancel" onclick={() => { moveDialogNodeId = null; }}>
          Cancel
        </button>
        <button type="button" class="move-confirm" disabled={moveSubmitting} onclick={submitMoveDialog}>
          {moveSubmitting ? "Moving..." : "Move"}
        </button>
      </div>
    </div>
  </div>
{/if}

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
  .move-overlay {
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--bg) 72%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    z-index: 20;
  }
  .move-sheet {
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
  .move-title {
    font-family: var(--m);
    font-size: 12px;
    color: var(--t2);
    font-weight: 600;
  }
  .move-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-family: var(--m);
    font-size: 10px;
    color: var(--t4);
  }
  .move-field select,
  .move-field input {
    width: 100%;
    border: 1px solid var(--b1);
    border-radius: 8px;
    background: var(--bg2);
    color: var(--t2);
    padding: 8px 10px;
    font: inherit;
  }
  .move-error {
    font-family: var(--m);
    font-size: 10px;
    color: #ef4444;
  }
  .move-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .move-cancel,
  .move-confirm {
    border-radius: 8px;
    padding: 7px 10px;
    font-family: var(--m);
    font-size: 10px;
    cursor: pointer;
  }
  .move-cancel {
    border: 1px solid var(--b1);
    background: var(--bg2);
    color: var(--t3);
  }
  .move-confirm {
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    background: color-mix(in srgb, var(--accent) 14%, var(--bg));
    color: var(--t2);
  }
</style>
