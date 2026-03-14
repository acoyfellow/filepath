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
</script>

<div
  class={`grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 border-l-2 px-3 py-2 transition-colors sm:px-3 ${
    isSelected
      ? "border-l-(--accent) bg-[color-mix(in_srgb,var(--accent)_8%,var(--bg))]"
      : "border-l-transparent hover:bg-(--bg3)"
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
  <StatusDot status={agent.status} size={5} />

  <span
    class="min-w-0 truncate font-(family-name:--f) text-[13px] leading-none tracking-[-0.01em]"
    style:font-weight={isSelected ? 600 : 400}
    style:color={isSelected ? "var(--t1)" : "var(--t3)"}
  >
    {agent.name}
  </span>

  <DropdownMenu.Root>
    <DropdownMenu.Trigger
      data-testid="agent-list-item-menu"
      class={`inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-transparent bg-transparent p-0 text-(--t5) transition-all hover:border-(--b1) hover:bg-(--bg3) hover:text-(--t2) ${
        isSelected ? "opacity-100" : "opacity-70"
      } data-[state=open]:border-(--b1) data-[state=open]:bg-(--bg3) data-[state=open]:text-(--t1)`}
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
      class="min-w-[9.75rem] rounded-xl border border-(--b1) bg-(--bg) p-1.5 text-(--t2) shadow-(--shadow)"
      onclick={(event) => {
        event.stopPropagation();
      }}
    >
      <DropdownMenu.Item
        class="rounded-lg px-3 py-2 font-(family-name:--f) text-[13px] font-medium text-(--t2) [&_svg]:text-(--t4) data-highlighted:bg-(--bg3) data-highlighted:text-(--t1) data-highlighted:[&_svg]:text-(--t2)"
        onclick={() => onrequestaction({ agentId: agent.id, action: "rename" })}
      >
        <PencilIcon />
        Rename
      </DropdownMenu.Item>
      <DropdownMenu.Separator class="bg-(--b1) my-1" />
      <DropdownMenu.Item
        variant="destructive"
        class="rounded-lg px-3 py-2 font-(family-name:--f) text-[13px] font-medium text-red-500 [&_svg]:text-red-500 data-highlighted:bg-red-500/10 data-highlighted:text-red-400 data-highlighted:[&_svg]:text-red-400 dark:text-red-400"
        onclick={() => onrequestaction({ agentId: agent.id, action: "delete" })}
      >
        <Trash2Icon />
        Delete agent
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</div>
