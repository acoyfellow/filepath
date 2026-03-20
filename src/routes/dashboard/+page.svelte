<script lang="ts">
  import { goto } from "$app/navigation";
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import Button from "$lib/components/ui/button/button.svelte";
  import SEO from "$lib/components/SEO.svelte";
  import type { ConversationState } from "$lib/conversations";

  interface WorkspaceItem {
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
  }

  interface ConversationItem {
    id: string;
    workspaceId: string;
    workspaceName: string;
    name: string;
    model: string;
    harnessId: string;
    conversationState: ConversationState;
    latestInterruption?: { summary: string } | null;
    activeIdentity?: { runId: string | null; traceId: string | null } | null;
    updatedAt: string | number | Date;
    closedAt?: number | null;
  }

  let { data } = $props();

  const workspaces = $derived(data.workspaces as WorkspaceItem[]);
  const conversations = $derived(data.conversations as ConversationItem[]);
  const totalWorkspaces = $derived(workspaces.length);
  const totalConversations = $derived(conversations.length);

  let errorMsg = $state<string | null>(null);
  let showNewModal = $state(false);
  let newName = $state("");
  let isCreating = $state(false);

  const stateOrder: ConversationState[] = ["blocked", "running", "ready", "closed"];
  const stateLabels: Record<ConversationState, string> = {
    blocked: "Blocked",
    running: "Running",
    ready: "Ready",
    closed: "Closed",
  };
  const stateDescriptions: Record<ConversationState, string> = {
    blocked: "Needs a human decision before it can continue.",
    running: "Actively doing bounded work now.",
    ready: "Open and ready for the next turn.",
    closed: "Frozen until you reopen it.",
  };
  const stateBadgeClass: Record<ConversationState, string> = {
    blocked: "border-amber-400/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    running: "border-sky-400/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    ready: "border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    closed: "border-(--b1) bg-(--bg3) text-(--t4)",
  };

  function groupConversations(state: ConversationState) {
    return conversations.filter((entry) => entry.conversationState === state);
  }

  function formatAge(value: string | number | Date): string {
    const ts =
      typeof value === "number"
        ? value
        : value instanceof Date
          ? value.getTime()
          : Date.parse(value);
    const delta = Math.max(0, Date.now() - ts);
    const minutes = Math.floor(delta / 60_000);
    if (minutes < 1) return "updated now";
    if (minutes < 60) return `updated ${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `updated ${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `updated ${days}d ago`;
  }

  async function createWorkspace() {
    isCreating = true;
    errorMsg = null;
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create workspace");
      const payload = (await res.json()) as { id: string };
      goto(`/workspace/${payload.id}`);
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : "Failed to create workspace";
    } finally {
      isCreating = false;
    }
  }

  function openConversation(entry: ConversationItem) {
    goto(`/workspace/${entry.workspaceId}?conversation=${encodeURIComponent(entry.id)}`);
  }
</script>

<SEO
  title="Dashboard | filepath"
  description="Your workspaces and their conversation status."
  keywords="filepath inbox, conversations, sandboxed work"
  path="/dashboard"
  type="website"
  section="Dashboard"
  tags="dashboard,conversations,workspaces"
  noindex
  breadcrumbs={[{ name: "Dashboard", item: "/dashboard" }]}
/>

<div class="min-h-screen bg-(--bg2) font-(family-name:--f) text-(--t2)">
  <main class="mx-auto flex w-full flex-col gap-8 px-6 py-10">
    <section class="flex flex-col gap-4 w-full">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <span class="text-[11px] uppercase tracking-[0.18em] text-(--t5)">
          Workspaces ({totalWorkspaces})
        </span>
        <Button
          variant="accentPill"
          class="h-11 gap-2 px-5"
          onclick={() => {
            newName = "";
            showNewModal = true;
          }}
        >
          <PlusIcon size={16} />
          <span>New workspace</span>
        </Button>
      </div>

      <div class="w-full space-y-8">
      
          {#if totalConversations === 0}
            <div class="rounded-[1.6rem] border border-dashed border-(--b1) bg-(--bg) p-8 text-center">
              <div class="text-[11px] uppercase tracking-[0.18em] text-(--t5)">No conversations yet</div>
              <div class="mt-3 text-xl font-semibold text-(--t1)">Create your first workspace</div>
              <div class="mt-2 text-sm text-(--t4)">Start a bounded background run and keep everything organized.</div>
              <div class="mt-5 flex justify-center">
                <Button
                  variant="accentPill"
                  class="px-6"
                  onclick={() => {
                    newName = "";
                    showNewModal = true;
                  }}
                >
                  New workspace
                </Button>
              </div>
            </div>
          {:else}
            {#each stateOrder as state}
              {@const items = groupConversations(state)}
              <section class="rounded-[1.6rem] border border-(--b1) bg-(--bg) p-5">
                <div class="mb-4 flex items-end justify-between gap-3">
                  <div>
                    <div class={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${stateBadgeClass[state]}`}>
                      {stateLabels[state]}
                    </div>
                    <p class="mt-2 text-sm text-(--t4)">{stateDescriptions[state]}</p>
                  </div>
                  <div class="text-xs text-(--t5)">{items.length} conversation{items.length === 1 ? "" : "s"}</div>
                </div>

                {#if items.length === 0}
                  <div class="rounded-2xl border border-dashed border-(--b1) bg-(--bg2) px-4 py-5 text-sm text-(--t5)">
                    No {stateLabels[state].toLowerCase()} conversations yet.
                  </div>
                {:else}
                  <div class="flex flex-col gap-3">
                    {#each items as entry (entry.id)}
                      <Button
                        variant="ghost"
                        class="group flex flex-col w-full gap-3 rounded-2xl border border-(--b1) bg-(--bg2) px-4 py-4 text-left items-start justify-start transition hover:border-(--b2) hover:bg-(--bg3) h-full "
                        onclick={() => openConversation(entry)}
                      >
                        <div class="col-span-1 flex items-start justify-between gap-4 w-full ">
                          <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-2">
                              <span class="text-base font-[620] tracking-[-0.02em] text-(--t1)">{entry.name}</span>
                              <span class={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${stateBadgeClass[entry.conversationState]}`}>
                                {stateLabels[entry.conversationState]}
                              </span>
                            </div>
                            <div class="mt-1 text-xs uppercase tracking-[0.16em] text-(--t5)">{entry.workspaceName}</div>
                          </div>
                          <span class="mt-1 inline-flex shrink-0 items-center text-(--t5) transition group-hover:text-(--t2)">
                            <ArrowRightIcon size={16} />
                          </span>
                        </div>

                        <div class="text-sm leading-7 text-(--t3) max-h-[3.5rem] overflow-hidden">

                          {entry.latestInterruption?.summary ?? `${entry.harnessId} · ${entry.model}`}
                        </div>

                        <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-(--t5)">
                          <span>{formatAge(entry.updatedAt)}</span>
                          {#if entry.activeIdentity?.runId}
                            <span>run {entry.activeIdentity.runId.slice(0, 8)}</span>
                          {/if}
                          {#if entry.activeIdentity?.traceId}
                            <span>trace {entry.activeIdentity.traceId.slice(0, 8)}</span>
                          {/if}
                        </div>
                      </Button>
                    {/each}
                  </div>
                {/if}
              </section>
            {/each}
          {/if}
      
      </div>
    </section>

    {#if errorMsg}
      <div class="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
        {errorMsg}
      </div>
    {/if}

  </main>

  {#if showNewModal}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 z-100 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-workspace-title"
      tabindex="-1"
      onclick={() => (showNewModal = false)}
      onkeydown={(e) => {
        if (e.key === "Escape") showNewModal = false;
      }}
    >
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="w-full max-w-[400px] rounded-2xl border border-(--b1) bg-(--bg) p-6 shadow-(--shadow)"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
      >
        <h2 id="new-workspace-title" class="mb-5 text-lg font-semibold tracking-tight text-(--t1)">New workspace</h2>

        <label class="mb-3.5 block text-sm font-medium text-(--t4)">
          Name
          <input type="text" class="mt-1.5 block w-full rounded-xl border border-(--b1) bg-(--bg2) px-3 py-2.5 text-sm text-(--t1) outline-none focus:border-(--accent)" placeholder="my-project" bind:value={newName} />
        </label>

        <div class="mt-5 flex justify-end gap-2">
          <Button variant="outline" class="rounded-xl" onclick={() => (showNewModal = false)}>Cancel</Button>
          <Button variant="accent" disabled={isCreating} class="rounded-xl" onclick={createWorkspace}>
            {isCreating ? "Creating..." : "Create workspace"}
          </Button>
        </div>
      </div>
    </div>
  {/if}
</div>
