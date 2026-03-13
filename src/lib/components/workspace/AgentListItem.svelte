<script lang="ts">
  import StatusDot from "$lib/components/shared/StatusDot.svelte";
  import type { AgentRecord } from "$lib/types/workspace";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import MoreHorizontalIcon from "@lucide/svelte/icons/ellipsis";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";

  interface Props {
    agent: AgentRecord;
    selectedId: string | null;
    onselect: (id: string) => void;
    onrequestaction: (payload: { agentId: string; action: "rename" | "delete" }) => void;
  }

  let { agent, selectedId, onselect, onrequestaction }: Props = $props();
  let isSelected = $derived(agent.id === selectedId);
  let scopeLabel = $derived.by(() => {
    const raw = agent.writableRoot ?? agent.allowedPaths[0] ?? ".";
    if (!raw || raw === "." || raw === "./") return "repo root";
    return raw;
  });
</script>

<div
  class="agent-list-item"
  class:selected={isSelected}
  role="button"
  tabindex="0"
  aria-pressed={isSelected}
  onclick={() => onselect(agent.id)}
  onkeydown={(event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onselect(agent.id);
    }
  }}
>
  <div class="agent-list-item-dot">
    <StatusDot status={agent.status} size={5} />
  </div>

  <span
    class="agent-list-item-name"
    style:font-weight={isSelected ? 600 : 400}
    style:color={isSelected ? "var(--t1)" : "var(--t3)"}
  >
    {agent.name}
  </span>

  <span class="agent-list-item-scope" title={scopeLabel}>{scopeLabel}</span>

  <DropdownMenu.Root>
    <DropdownMenu.Trigger
      class="agent-list-item-menu"
      aria-label={`Agent actions for ${agent.name}`}
      onclick={(event) => {
        event.stopPropagation();
      }}
    >
      <MoreHorizontalIcon size={14} />
    </DropdownMenu.Trigger>
    <DropdownMenu.Content
      align="end"
      sideOffset={6}
      onclick={(event) => {
        event.stopPropagation();
      }}
    >
      <DropdownMenu.Item onclick={() => onrequestaction({ agentId: agent.id, action: "rename" })}>
        <PencilIcon />
        Rename
      </DropdownMenu.Item>
      <DropdownMenu.Separator />
      <DropdownMenu.Item
        variant="destructive"
        onclick={() => onrequestaction({ agentId: agent.id, action: "delete" })}
      >
        <Trash2Icon />
        Delete
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</div>

<style>
  .agent-list-item {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-areas:
      "dot name menu"
      "dot scope menu";
    align-items: center;
    column-gap: 8px;
    row-gap: 2px;
    padding: 8px 10px;
    cursor: pointer;
    border-left: 2px solid transparent;
    transition: background 0.06s;
  }

  .agent-list-item-dot {
    grid-area: dot;
    align-self: start;
    padding-top: 2px;
  }

  .agent-list-item:hover {
    background: var(--bg3);
  }

  .agent-list-item.selected {
    background: color-mix(in srgb, var(--accent) 8%, var(--bg));
    border-left-color: var(--accent);
  }

  .agent-list-item-name {
    grid-area: name;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--m);
    font-size: 11px;
  }

  .agent-list-item-scope {
    grid-area: scope;
    justify-self: start;
    border: 1px solid var(--b1);
    border-radius: 999px;
    background: var(--bg3);
    padding: 2px 6px;
    font-family: var(--m);
    font-size: 9px;
    color: var(--t5);
  }

  :global(.agent-list-item-menu) {
    grid-area: menu;
    display: inline-flex;
    width: 22px;
    height: 22px;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 6px;
    background: none;
    color: var(--t6);
    cursor: pointer;
    opacity: 0.9;
    align-self: center;
  }

  :global(.agent-list-item-menu:hover) {
    background: var(--bg3);
    color: var(--t3);
  }

  @media (max-width: 640px) {
    .agent-list-item {
      padding: 10px 12px;
    }

    .agent-list-item-name {
      font-size: 12px;
    }

    .agent-list-item-scope {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
</style>
