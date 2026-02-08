<script lang="ts">
  import StatusDot from "$lib/components/shared/StatusDot.svelte";
  import type { AgentNode } from "$lib/types/session";

  interface Props {
    node: AgentNode;
    selectedId: string | null;
    depth?: number;
    onselect: (id: string) => void;
    ontoggle: (id: string) => void;
  }

  let { node, selectedId, depth = 0, onselect, ontoggle }: Props = $props();

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
</script>

<div
  class="tn"
  class:sel={isSelected}
  style:padding-left="{8 + depth * 16}px"
  role="treeitem"
  tabindex="0"
  aria-selected={isSelected}
  onclick={() => onselect(node.id)}
  onkeydown={(e) => { if (e.key === 'Enter') onselect(node.id); }}
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
</div>

{#if hasChildren && !collapsed}
  {#each node.children as child (child.id)}
    <svelte:self
      node={child}
      {selectedId}
      depth={depth + 1}
      {onselect}
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
</style>
