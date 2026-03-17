<script lang="ts">
  import PlusIcon from "@lucide/svelte/icons/plus";
  import { alert, confirm } from "$lib/components/alert";
  import AgentListItem from "./AgentListItem.svelte";
  import type { AgentRecord } from "$lib/types/workspace";
  import * as Dialog from "$lib/components/ui/dialog";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import Button from "$lib/components/ui/button/button.svelte";

  const sidebar = Sidebar.useSidebar();

  interface Props {
    agents: AgentRecord[];
    selectedId: string | null;
    isRefreshing?: boolean;
    onselect: (id: string) => void;
    onrename: (payload: { agentId: string; name: string }) => Promise<void>;
    ondelete: (agentId: string) => Promise<void>;
    oncreate: () => void;
  }

  let {
    agents,
    selectedId,
    isRefreshing = false,
    onselect,
    onrename,
    ondelete,
    oncreate,
  }: Props = $props();

  let dialogAgentId = $state<string | null>(null);
  let renameValue = $state("");
  let dialogError = $state("");
  let dialogSubmitting = $state(false);

  const dialogAgent = $derived(
    dialogAgentId ? agents.find((agent) => agent.id === dialogAgentId) ?? null : null,
  );

  function closeDialog() {
    dialogAgentId = null;
    renameValue = "";
    dialogError = "";
    dialogSubmitting = false;
  }

  function openRename(agentId: string) {
    dialogAgentId = agentId;
    renameValue = agents.find((agent) => agent.id === agentId)?.name ?? "";
    dialogError = "";
  }

  async function confirmDelete(agentId: string) {
    const accepted = await confirm("Delete this agent?");
    if (!accepted) return;

    try {
      await ondelete(agentId);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to delete agent", "error");
    }
  }

  async function handleAction(payload: { agentId: string; action: "rename" | "delete" }) {
    if (payload.action === "delete") {
      await confirmDelete(payload.agentId);
      return;
    }

    openRename(payload.agentId);
  }

  async function submitRename() {
    if (!dialogAgentId) return;
    dialogSubmitting = true;
    dialogError = "";

    try {
      const name = renameValue.trim();
      if (!name) throw new Error("Name is required");
      await onrename({ agentId: dialogAgentId, name });
      closeDialog();
    } catch (error) {
      dialogError = error instanceof Error ? error.message : "Unable to rename agent";
    } finally {
      dialogSubmitting = false;
    }
  }
</script>

<Sidebar.Root class="top-(--header-height)! bottom-auto! h-[calc(100svh-var(--header-height))]!">
  <Sidebar.Header>
    <div class="flex items-center justify-between gap-3 px-2 py-2">
        <div class="flex items-center gap-1.5 font-(family-name:--f) text-[10px] font-[550] uppercase tracking-[0.14em] text-(--t4) sm:text-[11px]">
        <span>conversations</span>
        {#if isRefreshing}
          <span
            class="size-2.5 animate-spin rounded-full border-2 border-(--b2) border-t-(--accent)"
            aria-hidden="true"
          ></span>
        {/if}
      </div>
      <Button
        variant="ghost"
        size="sm"
        class="h-7 gap-1.5 rounded-full px-2.5 font-(family-name:--f) text-[11px] font-[540] text-(--t3) shadow-none hover:bg-(--bg3) hover:text-(--t1)"
        onclick={oncreate}
        aria-label="Create conversation"
        title="Create conversation"
        data-testid="open-create-agent"
      >
        <PlusIcon size={14} />
        <span class="max-[640px]:hidden">new conversation</span>
      </Button>
    </div>
  </Sidebar.Header>
  <Sidebar.Content>
    {#if agents.length > 0}
      <Sidebar.Group>
        <div class="py-0.5">
          {#each agents as agent (agent.id)}
            <AgentListItem
              {agent}
              {selectedId}
              onselect={(id) => {
                onselect(id);
                sidebar.setOpenMobile(false);
              }}
              onrequestaction={handleAction}
            />
          {/each}
        </div>
      </Sidebar.Group>
    {:else}
      <div class="px-3 py-4 font-(family-name:--f) text-xs text-(--t5)">No conversations yet</div>
    {/if}
  </Sidebar.Content>
</Sidebar.Root>

<Dialog.Root
  open={Boolean(dialogAgentId)}
  onOpenChange={(open) => {
    if (!open) closeDialog();
  }}
>
  <Dialog.Content class="max-w-md border-(--b1) bg-(--bg) text-(--t2)">
    <Dialog.Header>
      <Dialog.Title class="dialog-title">Rename conversation</Dialog.Title>
      <Dialog.Description class="dialog-description">
        {#if dialogAgent}
          Update the display name for <strong>{dialogAgent.name}</strong>.
        {/if}
      </Dialog.Description>
    </Dialog.Header>

    <label>
      <span class="mb-1.5 block text-sm font-medium text-(--t3)">Name</span>
      <input
        bind:value={renameValue}
        type="text"
        maxlength="120"
        class="w-full rounded-xl border border-(--b1) bg-(--bg2) px-3 py-2.5 text-sm text-(--t1) outline-none transition focus:border-(--accent)"
      />
    </label>

    {#if dialogError}
      <div class="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
        {dialogError}
      </div>
    {/if}

    <Dialog.Footer class="gap-2">
      <Button variant="outline" onclick={closeDialog}>Cancel</Button>
      <Button disabled={dialogSubmitting} onclick={submitRename}>
        {dialogSubmitting ? "Saving..." : "Rename"}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
