<script lang="ts">
  import TreeNode from "./TreeNode.svelte";
  import type { AgentNode } from "$lib/types/session";

  interface Props {
    root: AgentNode | null;
    selectedId: string | null;
    width?: number;
    onselect: (id: string) => void;
    onspawn: () => void;
  }

  let { root, selectedId, width = 220, onselect, onspawn }: Props = $props();

  // Resize state
  let dragging = $state(false);
  let treeWidth = $state(width);

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
        spawn
      </button>
    </div>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="resize-handle" onmousedown={onMouseDown}></div>
</div>

<style>
  .tree-container {
    display: flex;
    flex-shrink: 0;
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
</style>
