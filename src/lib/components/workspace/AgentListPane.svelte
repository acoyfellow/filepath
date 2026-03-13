<script lang="ts">
  import PlusIcon from "@lucide/svelte/icons/plus";
  import { alert, confirm } from "$lib/components/alert";
  import AgentListItem from "./AgentListItem.svelte";
  import type { AgentRecord } from "$lib/types/workspace";
  import * as Dialog from "$lib/components/ui/dialog";
  import Button from "$lib/components/ui/button/button.svelte";

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

  const sortedAgents = $derived(
    [...agents].sort((left, right) => right.updatedAt - left.updatedAt),
  );
  const dialogAgent = $derived(
    dialogAgentId ? sortedAgents.find((agent) => agent.id === dialogAgentId) ?? null : null,
  );

  function closeDialog() {
    dialogAgentId = null;
    renameValue = "";
    dialogError = "";
    dialogSubmitting = false;
  }

  function openRename(agentId: string) {
    dialogAgentId = agentId;
    renameValue = sortedAgents.find((agent) => agent.id === agentId)?.name ?? "";
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

<aside class="flex min-h-0 w-[260px] shrink-0 flex-col border-r border-[var(--b1)] bg-[var(--bg)] max-[900px]:max-h-[34vh] max-[900px]:w-full max-[900px]:border-r-0 max-[900px]:border-b">
  <div class="flex items-center gap-1.5 border-b border-[var(--b1)] px-3 py-2 font-[var(--f)] text-[10px] font-[550] uppercase tracking-[0.14em] text-[var(--t4)] sm:text-[11px]">
    <span>agents</span>
    {#if isRefreshing}
      <span
        class="size-2.5 animate-spin rounded-full border-2 border-[var(--b2)] border-t-[var(--accent)]"
        aria-hidden="true"
      ></span>
    {/if}
  </div>

  <div class="min-h-0 flex-1 overflow-auto py-0.5 max-[900px]:max-h-[26vh]">
    {#if sortedAgents.length > 0}
      {#each sortedAgents as agent (agent.id)}
        <AgentListItem
          {agent}
          {selectedId}
          {onselect}
          onrequestaction={handleAction}
        />
      {/each}
    {:else}
      <div class="px-3 py-4 font-[var(--f)] text-xs text-[var(--t5)]">No agents yet</div>
    {/if}
  </div>

  <div class="border-t border-[var(--b1)] px-2 py-2 max-[640px]:px-3 max-[640px]:pb-2.5">
    <Button
      variant="outline"
      class="flex w-full items-center justify-center gap-2 rounded-xl border-dashed border-[var(--b2)] bg-[color-mix(in_srgb,var(--bg2)_88%,transparent)] py-5 font-[var(--f)] text-xs font-[540] text-[var(--t3)] shadow-none hover:border-[var(--t4)] hover:bg-[color-mix(in_srgb,var(--accent)_9%,var(--bg3))] hover:text-[var(--t1)] max-[640px]:py-4"
      onclick={oncreate}
    >
      <PlusIcon size={15} />
      new agent
    </Button>
  </div>
</aside>

<Dialog.Root
  open={Boolean(dialogAgentId)}
  onOpenChange={(open) => {
    if (!open) closeDialog();
  }}
>
  <Dialog.Content class="max-w-md border-border bg-background text-foreground">
    <Dialog.Header>
      <Dialog.Title class="dialog-title">Rename agent</Dialog.Title>
      <Dialog.Description class="dialog-description">
        {#if dialogAgent}
          Update the display name for <strong>{dialogAgent.name}</strong>.
        {/if}
      </Dialog.Description>
    </Dialog.Header>

    <label>
      <span class="mb-1.5 block text-sm font-medium text-[var(--t3)]">Name</span>
      <input
        bind:value={renameValue}
        type="text"
        maxlength="120"
        class="w-full rounded-xl border border-[var(--b1)] bg-[var(--bg2)] px-3 py-2.5 text-sm text-[var(--t1)] outline-none transition focus:border-[var(--accent)]"
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
