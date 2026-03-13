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
  class={`grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 border-l-2 px-3 py-2 transition-colors sm:px-3 ${
    isSelected
      ? "border-l-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,var(--bg))]"
      : "border-l-transparent hover:bg-[var(--bg3)]"
  }`}
  data-testid="agent-list-item"
  data-selected={isSelected ? "true" : "false"}
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
  <div class="row-start-1 row-end-3 self-start pt-0.5">
    <StatusDot status={agent.status} size={5} />
  </div>

  <span
    class="min-w-0 truncate font-[var(--f)] text-[13px] tracking-[-0.01em]"
    style:font-weight={isSelected ? 600 : 400}
    style:color={isSelected ? "var(--t1)" : "var(--t3)"}
  >
    {agent.name}
  </span>

  <span
    class="col-start-2 row-start-2 inline-flex max-w-full justify-self-start truncate rounded-full border border-[var(--b1)] bg-[var(--bg3)] px-1.5 py-0.5 font-[var(--m)] text-[10px] text-[var(--t4)]"
    title={scopeLabel}
  >
    {scopeLabel}
  </span>

  <DropdownMenu.Root>
    <DropdownMenu.Trigger
      data-testid="agent-list-item-menu"
      class="col-start-3 row-span-2 inline-flex size-[22px] items-center justify-center self-center rounded-md bg-transparent text-[var(--t5)] opacity-90 transition-colors hover:bg-[var(--bg3)] hover:text-[var(--t2)]"
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
