<script lang="ts">
  import Self from "./TreeNode.svelte";
  import StatusDot from "$lib/components/shared/StatusDot.svelte";
  import type { AgentNode } from "$lib/types/session";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import MoreHorizontalIcon from "@lucide/svelte/icons/ellipsis";
  import MoveRightIcon from "@lucide/svelte/icons/move";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";

  interface Props {
    node: AgentNode;
    selectedId: string | null;
    depth?: number;
    onselect: (id: string) => void;
    onmove: (payload: { nodeId: string; parentId: string | null; sortOrder: number }) => Promise<void>;
    onrequestaction: (payload: { nodeId: string; action: "move" | "rename" | "delete" }) => void;
    ontoggle: (id: string) => void;
  }

  let { node, selectedId, depth = 0, onselect, onmove, onrequestaction, ontoggle }: Props = $props();

  let hasChildren = $derived(node.children.length > 0);
  let isSelected = $derived(node.id === selectedId);
  let collapsed = $state(false);

  /** Count done/total leaves for completion display */
  function countLeaves(n: AgentNode): { total: number; done: number } {
    if (n.children.length === 0) {
      return { total: 1, done: n.status === "done" ? 1 : 0 };
    }
    let total = 0, done = 0;
    for (const c of n.children) {
      const r = countLeaves(c);
      total += r.total;
      done += r.done;
    }
    return { total, done };
  }

  let leafCount = $derived(hasChildren ? countLeaves(node) : null);
  let dropMode = $state<"before" | "after" | "nest" | null>(null);

  function handleDragStart(event: DragEvent) {
    event.dataTransfer?.setData("text/plain", node.id);
    event.dataTransfer?.setData("application/x-filepath-agent", node.id);
    event.dataTransfer?.setDragImage(event.currentTarget as Element, 16, 16);
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetY = event.clientY - rect.top;
    const ratio = offsetY / rect.height;
    if (ratio < 0.25) {
      dropMode = "before";
    } else if (ratio > 0.75) {
      dropMode = "after";
    } else {
      dropMode = "nest";
    }
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault();
    const draggedId =
      event.dataTransfer?.getData("application/x-filepath-agent") ||
      event.dataTransfer?.getData("text/plain");
    if (!draggedId || draggedId === node.id || !dropMode) {
      dropMode = null;
      return;
    }

    const payload =
      dropMode === "nest"
        ? { nodeId: draggedId, parentId: node.id, sortOrder: node.children.length }
        : {
            nodeId: draggedId,
            parentId: node.parentId,
            sortOrder: dropMode === "before" ? node.sortOrder : node.sortOrder + 1,
          };

    try {
      await onmove(payload);
    } finally {
      dropMode = null;
    }
  }
</script>

<div
  class="tn"
  class:sel={isSelected}
  class:drop-before={dropMode === "before"}
  class:drop-after={dropMode === "after"}
  class:drop-nest={dropMode === "nest"}
  style:padding-left="{8 + depth * 16}px"
  role="treeitem"
  tabindex="0"
  aria-selected={isSelected}
  draggable="true"
  onclick={() => onselect(node.id)}
  onkeydown={(e) => { if (e.key === 'Enter') onselect(node.id); }}
  ondragstart={handleDragStart}
  ondragover={handleDragOver}
  ondragleave={() => { dropMode = null; }}
  ondrop={handleDrop}
>
  <button
    class="tn-toggle"
    style:color={hasChildren ? "var(--t4)" : "var(--t6)"}
    style:cursor={hasChildren ? "pointer" : "default"}
    onclick={(e) => {
      e.stopPropagation();
      if (hasChildren) {
        collapsed = !collapsed;
        ontoggle(node.id);
      }
    }}
  >
    {#if hasChildren}
      <svg width="9" height="9" viewBox="0 0 12 12" style:transform={collapsed ? "" : "rotate(90deg)"} style:transition="transform .1s">
        <path d="M4 2L8.5 6L4 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    {:else}
      <svg width="8" height="8" viewBox="0 0 12 12">
        <rect x="2" y="3" width="8" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.1" />
        <path d="M2 5h8" stroke="currentColor" stroke-width="0.8" />
      </svg>
    {/if}
  </button>

  <StatusDot status={node.status} size={5} />

  <span class="tn-name" style:font-weight={isSelected ? 600 : 400} style:color={isSelected ? "var(--t1)" : "var(--t3)"}>
    {node.name}
  </span>

  {#if leafCount}
    <span class="tn-count">{leafCount.done}/{leafCount.total}</span>
  {/if}

  <DropdownMenu.Root>
    <DropdownMenu.Trigger
      class="tn-menu"
      aria-label={`Agent actions for ${node.name}`}
      onclick={(e) => {
        e.stopPropagation();
      }}
    >
      <MoreHorizontalIcon size={14} />
    </DropdownMenu.Trigger>
    <DropdownMenu.Content
      align="end"
      sideOffset={6}
      onclick={(e) => {
        e.stopPropagation();
      }}
    >
      <DropdownMenu.Item
        onclick={() => onrequestaction({ nodeId: node.id, action: "move" })}
      >
        <MoveRightIcon />
        Move
      </DropdownMenu.Item>
      <DropdownMenu.Item
        onclick={() => onrequestaction({ nodeId: node.id, action: "rename" })}
      >
        <PencilIcon />
        Rename
      </DropdownMenu.Item>
      <DropdownMenu.Separator />
      <DropdownMenu.Item
        variant="destructive"
        onclick={() => onrequestaction({ nodeId: node.id, action: "delete" })}
      >
        <Trash2Icon />
        Delete
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</div>

{#if hasChildren && !collapsed}
  {#each node.children as child (child.id)}
    <Self
      node={child}
      {selectedId}
      depth={depth + 1}
      {onselect}
      {onmove}
      {onrequestaction}
      {ontoggle}
    />
  {/each}
{/if}

<style>
  .tn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    cursor: pointer;
    border-left: 2px solid transparent;
    transition: background 0.06s;
  }
  .tn:hover {
    background: var(--bg3);
  }
  .tn.sel {
    background: color-mix(in srgb, var(--accent) 8%, var(--bg));
    border-left-color: var(--accent);
  }
  .tn.drop-before {
    box-shadow: inset 0 2px 0 color-mix(in srgb, var(--accent) 60%, transparent);
  }
  .tn.drop-after {
    box-shadow: inset 0 -2px 0 color-mix(in srgb, var(--accent) 60%, transparent);
  }
  .tn.drop-nest {
    background: color-mix(in srgb, var(--accent) 10%, var(--bg));
  }
  .tn-toggle {
    background: none;
    border: none;
    padding: 0;
    width: 14px;
    height: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: inherit;
  }
  .tn-name {
    font-family: var(--m);
    font-size: 11px;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tn-count {
    font-family: var(--m);
    font-size: 9px;
    color: var(--t5);
  }
  :global(.tn-menu) {
    border: none;
    background: none;
    color: var(--t6);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    width: 22px;
    height: 22px;
    cursor: pointer;
    opacity: 0.9;
  }
  :global(.tn-menu:hover) {
    background: var(--bg3);
    color: var(--t3);
  }
</style>
