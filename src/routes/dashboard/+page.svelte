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
    gitRepoUrl?: string | null;
    memoryEnabled?: boolean;
    memoryScope?: string | null;
    createdAt: number;
    updatedAt: number;
  }

  interface ConversationItem {
    id: string;
    workspaceId: string;
    workspaceName: string;
    workspaceGitRepoUrl?: string | null;
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

  let errorMsg = $state<string | null>(null);
  let showNewModal = $state(false);
  let newName = $state("");
  let newGitUrl = $state("");
  let newMemoryEnabled = $state(false);
  let newMemoryScope = $state("shared");
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
          gitRepoUrl: newGitUrl.trim() || undefined,
          memoryEnabled: newMemoryEnabled,
          memoryScope: newMemoryEnabled ? newMemoryScope.trim() || "shared" : undefined,
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
  title="Inbox | filepath"
  description="Your global inbox of conversations across sandboxed workspaces."
  keywords="filepath inbox, conversations, sandboxed work"
  path="/dashboard"
  type="website"
  section="Inbox"
  tags="inbox,conversations,workspaces"
  noindex
  breadcrumbs={[{ name: "Inbox", item: "/dashboard" }]}
/>

<div class="min-h-screen bg-(--bg2) font-(family-name:--f) text-(--t2)">
  <main class="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 max-[640px]:px-4 max-[640px]:py-8">
    <section class="flex flex-col gap-4 rounded-[2rem] border border-(--b1) bg-(--bg) p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)]">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="max-w-2xl">
          <div class="text-[11px] uppercase tracking-[0.22em] text-(--t5)">filepath 0.05</div>
          <h1 class="mt-3 text-3xl font-[650] tracking-[-0.04em] text-(--t1) md:text-5xl">
            Inbox first. Conversations are the environment.
          </h1>
          <p class="mt-3 max-w-2xl text-sm leading-7 text-(--t4) md:text-base">
            Work is no longer scattered across tabs and background runs. Every conversation is either
            ready, running, blocked, or closed, and the inbox is the place you scan first.
          </p>
        </div>
        <Button
          class="h-11 gap-2 rounded-full bg-(--accent) px-5 text-white shadow-none hover:opacity-90"
          onclick={() => {
            newName = "";
            newGitUrl = "";
            newMemoryEnabled = false;
            newMemoryScope = "shared";
            showNewModal = true;
          }}
        >
          <PlusIcon size={16} />
          <span>New workspace</span>
        </Button>
      </div>

      <div class="grid gap-3 md:grid-cols-4">
        {#each stateOrder as state}
          <article class="rounded-2xl border border-(--b1) bg-(--bg2) p-4">
            <div class={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-[600] ${stateBadgeClass[state]}`}>
              {stateLabels[state]}
            </div>
            <div class="mt-3 text-2xl font-[650] tracking-[-0.03em] text-(--t1)">
              {groupConversations(state).length}
            </div>
            <p class="mt-1 text-xs leading-6 text-(--t4)">{stateDescriptions[state]}</p>
          </article>
        {/each}
      </div>
    </section>

    {#if errorMsg}
      <div class="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
        {errorMsg}
      </div>
    {/if}

    <section class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="flex flex-col gap-6">
        {#each stateOrder as state}
          {@const items = groupConversations(state)}
          <section class="rounded-[1.6rem] border border-(--b1) bg-(--bg) p-5">
            <div class="mb-4 flex items-end justify-between gap-3">
              <div>
                <div class={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-[600] ${stateBadgeClass[state]}`}>
                  {stateLabels[state]}
                </div>
                <p class="mt-2 text-sm text-(--t4)">{stateDescriptions[state]}</p>
              </div>
              <div class="text-xs text-(--t5)">{items.length} conversation{items.length === 1 ? "" : "s"}</div>
            </div>

            {#if items.length === 0}
              <div class="rounded-2xl border border-dashed border-(--b1) bg-(--bg2) px-4 py-5 text-sm text-(--t5)">
                Nothing here right now.
              </div>
            {:else}
              <div class="flex flex-col gap-3">
                {#each items as entry (entry.id)}
                  <button
                    class="group grid w-full gap-3 rounded-2xl border border-(--b1) bg-(--bg2) px-4 py-4 text-left transition hover:border-(--b2) hover:bg-(--bg3)"
                    onclick={() => openConversation(entry)}
                  >
                    <div class="flex items-start justify-between gap-4">
                      <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="text-base font-[620] tracking-[-0.02em] text-(--t1)">{entry.name}</span>
                          <span class={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-[600] ${stateBadgeClass[entry.conversationState]}`}>
                            {stateLabels[entry.conversationState]}
                          </span>
                        </div>
                        <div class="mt-1 text-xs uppercase tracking-[0.16em] text-(--t5)">{entry.workspaceName}</div>
                      </div>
                      <span class="mt-1 inline-flex shrink-0 items-center text-(--t5) transition group-hover:text-(--t2)">
                        <ArrowRightIcon size={16} />
                      </span>
                    </div>

                    <div class="text-sm leading-7 text-(--t3)">
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
                  </button>
                {/each}
              </div>
            {/if}
          </section>
        {/each}
      </div>

      <aside class="flex flex-col gap-4">
        <section class="rounded-[1.6rem] border border-(--b1) bg-(--bg) p-5">
          <div class="text-[11px] uppercase tracking-[0.18em] text-(--t5)">Workspaces</div>
          <div class="mt-3 flex flex-col gap-3">
            {#each workspaces as entry (entry.id)}
              <a
                class="rounded-2xl border border-(--b1) bg-(--bg2) px-4 py-3 transition hover:border-(--b2) hover:bg-(--bg3)"
                href={`/workspace/${entry.id}`}
              >
                <div class="text-sm font-[620] text-(--t1)">{entry.name}</div>
                <div class="mt-1 text-xs text-(--t5)">
                  {entry.memoryEnabled ? `memory on${entry.memoryScope ? ` · ${entry.memoryScope}` : ""}` : "memory off"}
                </div>
              </a>
            {/each}
          </div>
        </section>
      </aside>
    </section>
  </main>

  {#if showNewModal}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4"
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

        <label class="mb-3.5 block text-sm font-medium text-(--t4)">
          Git repo URL <span class="text-(--t5)">(optional)</span>
          <input type="text" class="mt-1.5 block w-full rounded-xl border border-(--b1) bg-(--bg2) px-3 py-2.5 text-sm text-(--t1) outline-none focus:border-(--accent)" placeholder="https://github.com/user/repo" bind:value={newGitUrl} />
        </label>

        <label class="mb-3.5 flex items-start gap-3 rounded-xl border border-(--b1) bg-(--bg2) px-3 py-3 text-sm text-(--t3)">
          <input type="checkbox" class="mt-1" bind:checked={newMemoryEnabled} />
          <span class="min-w-0">
            <span class="block font-medium text-(--t2)">Enable memory</span>
            <span class="block text-xs leading-6 text-(--t5)">Inject Deja recall before runs and store short run summaries after completion.</span>
          </span>
        </label>

        {#if newMemoryEnabled}
          <label class="mb-3.5 block text-sm font-medium text-(--t4)">
            Memory scope
            <input type="text" class="mt-1.5 block w-full rounded-xl border border-(--b1) bg-(--bg2) px-3 py-2.5 text-sm text-(--t1) outline-none focus:border-(--accent)" placeholder="shared" bind:value={newMemoryScope} />
          </label>
        {/if}

        <div class="mt-5 flex justify-end gap-2">
          <Button variant="outline" onclick={() => (showNewModal = false)}>Cancel</Button>
          <Button class="bg-(--accent) text-white shadow-none hover:opacity-90" disabled={isCreating} onclick={createWorkspace}>
            {isCreating ? "Creating..." : "Create workspace"}
          </Button>
        </div>
      </div>
    </div>
  {/if}
</div>
