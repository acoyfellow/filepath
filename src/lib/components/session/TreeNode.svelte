<script lang="ts">
  import StatusDot from "$lib/components/shared/StatusDot.svelte";
  import type { AgentRecord } from "$lib/types/workspace";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import MoreHorizontalIcon from "@lucide/svelte/icons/ellipsis";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";

  interface Props {
    node: AgentRecord;
    selectedId: string | null;
    onselect: (id: string) => void;
    onrequestaction: (payload: { agentId: string; action: "rename" | "delete" }) => void;
  }

  let { node, selectedId, onselect, onrequestaction }: Props = $props();
  let isSelected = $derived(node.id === selectedId);
  let scopeLabel = $derived(node.writableRoot ?? node.allowedPaths[0] ?? ".");
</script>

<div
  class="tn"
  class:sel={isSelected}
  role="treeitem"
  tabindex="0"
  aria-selected={isSelected}
  onclick={() => onselect(node.id)}
  onkeydown={(e) => { if (e.key === 'Enter') onselect(node.id); }}
>
  <StatusDot status={node.status} size={5} />

  <span class="tn-name" style:font-weight={isSelected ? 600 : 400} style:color={isSelected ? "var(--t1)" : "var(--t3)"}>
    {node.name}
  </span>

  <span class="tn-scope">{scopeLabel}</span>

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
        onclick={() => onrequestaction({ agentId: node.id, action: "rename" })}
      >
        <PencilIcon />
        Rename
      </DropdownMenu.Item>
      <DropdownMenu.Separator />
      <DropdownMenu.Item
        variant="destructive"
        onclick={() => onrequestaction({ agentId: node.id, action: "delete" })}
      >
        <Trash2Icon />
        Delete
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</div>

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
  .tn-name {
    font-family: var(--m);
    font-size: 11px;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tn-scope {
    font-family: var(--m);
    font-size: 9px;
    color: var(--t5);
    background: var(--bg3);
    border: 1px solid var(--b1);
    border-radius: 999px;
    padding: 2px 6px;
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
