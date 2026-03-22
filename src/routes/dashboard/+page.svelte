<script lang="ts">
  import { goto } from "$app/navigation";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
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
  const totalConversations = $derived(conversations.length);

  let errorMsg = $state<string | null>(null);
  let showNewModal = $state(false);
  let newName = $state("");
  let isCreating = $state(false);
  /** collapsed workspace ids; omitted = expanded */
  let collapsed = $state<Record<string, boolean>>({});

  const stateIndicatorClass: Record<ConversationState, string> = {
    blocked: "bg-amber-500 dark:bg-amber-400",
    running: "bg-sky-500 dark:bg-sky-400",
    ready: "bg-emerald-500 dark:bg-emerald-400",
    closed: "bg-(--t5)",
  };

  const stateAriaLabel: Record<ConversationState, string> = {
    blocked: "Blocked",
    running: "Running",
    ready: "Ready",
    closed: "Closed",
  };

  function sortTs(value: string | number | Date): number {
    if (typeof value === "number") return value;
    if (value instanceof Date) return value.getTime();
    return Date.parse(String(value));
  }

  const tree = $derived.by(() => {
    const map = new Map<
      string,
      { workspace: WorkspaceItem | null; conversations: ConversationItem[] }
    >();
    for (const w of workspaces) {
      map.set(w.id, { workspace: w, conversations: [] });
    }
    for (const c of conversations) {
      let row = map.get(c.workspaceId);
      if (!row) {
        row = { workspace: null, conversations: [] };
        map.set(c.workspaceId, row);
      }
      row.conversations.push(c);
    }
    for (const [, row] of map) {
      row.conversations.sort((a, b) => sortTs(b.updatedAt) - sortTs(a.updatedAt));
    }
    return [...map.values()].sort((a, b) => {
      const na = a.workspace?.name ?? a.conversations[0]?.workspaceName ?? "";
      const nb = b.workspace?.name ?? b.conversations[0]?.workspaceName ?? "";
      return na.localeCompare(nb);
    });
  });

  function formatAge(value: string | number | Date): string {
    const ts = sortTs(value);
    const delta = Math.max(0, Date.now() - ts);
    const minutes = Math.floor(delta / 60_000);
    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  function conversationHref(entry: ConversationItem): string {
    return `/workspace/${entry.workspaceId}?conversation=${encodeURIComponent(entry.id)}`;
  }

  function workspaceOpen(id: string): boolean {
    return collapsed[id] !== true;
  }

  function toggleWorkspace(id: string) {
    collapsed = { ...collapsed, [id]: !collapsed[id] };
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

  function openNewModal() {
    newName = "";
    showNewModal = true;
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

<div class="min-h-screen bg-(--bg) font-(family-name:--f) text-base leading-normal text-(--t2)">
  <main class="mx-auto w-full max-w-3xl px-4 py-6">
    <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-lg font-medium text-(--t1)">Workspaces</h1>
      <Button type="button" class="gap-2" onclick={openNewModal}>
        <PlusIcon size={16} />
        <span>New workspace</span>
      </Button>
    </header>

    {#if tree.length === 0}
      <p class="text-(--t4)">No workspaces yet.</p>
      <div class="mt-3">
        <Button type="button" class="gap-2" onclick={openNewModal}>
          <PlusIcon size={16} />
          <span>New workspace</span>
        </Button>
      </div>
    {:else}
      <div class="overflow-hidden rounded border border-(--b1) text-sm">
        {#each tree as row, i (row.workspace?.id ?? row.conversations[0]?.workspaceId ?? `w-${i}`)}
          {@const wid = row.workspace?.id ?? row.conversations[0]?.workspaceId ?? ""}
          {@const label = row.workspace?.name ?? row.conversations[0]?.workspaceName ?? wid}
          {@const open = workspaceOpen(wid)}
          {@const hasKids = row.conversations.length > 0}
          <div class="border-b border-(--b1) last:border-b-0">
            {#if hasKids}
              <button
                type="button"
                class="flex w-full items-center gap-0.5 bg-(--bg2) px-4 py-3 text-left font-(family-name:--m) text-[13px] text-(--t1) outline-none hover:bg-(--bg3) focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-inset"
                aria-expanded={open}
                aria-label={`${label} workspace, ${open ? "expanded" : "collapsed"}`}
                onclick={() => toggleWorkspace(wid)}
              >
                <span class="flex size-6 shrink-0 items-center justify-center text-(--t5)" aria-hidden="true">
                  {#if open}
                    <ChevronDownIcon size={14} strokeWidth={2} />
                  {:else}
                    <ChevronRightIcon size={14} strokeWidth={2} />
                  {/if}
                </span>
                <span class="min-w-0">{label}<span class="text-(--t4)">/</span></span>
              </button>
            {:else}
              <div class="flex items-center gap-0.5 bg-(--bg2) px-4 py-3 font-(family-name:--m) text-[13px] text-(--t1)">
                <span class="inline-block w-6 shrink-0" aria-hidden="true"></span>
                <span>{label}<span class="text-(--t4)">/</span></span>
              </div>
            {/if}

            {#if open && hasKids}
              {#each row.conversations as entry (entry.id)}
                <a
                  href={conversationHref(entry)}
                  class="flex items-center justify-between gap-4 border-t border-(--b1) px-4 py-2.5 pl-11 text-(--t1) no-underline outline-none hover:bg-(--bg3) hover:underline focus-visible:bg-(--bg3) focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-inset"
                  aria-label={`${entry.name}, ${stateAriaLabel[entry.conversationState]}, ${formatAge(entry.updatedAt)}`}
                >
                  <span class="min-w-0 flex-1 truncate">{entry.name}</span>
                  <span class="inline-flex shrink-0 items-center justify-end gap-2.5 font-(family-name:--m) text-xs text-(--t3) tabular-nums">
                    <span
                      class="size-2.5 shrink-0 rounded-full ring-1 ring-(--b1) {stateIndicatorClass[entry.conversationState]}"
                      title={stateAriaLabel[entry.conversationState]}
                      aria-hidden="true"
                    ></span>
                    <span>{formatAge(entry.updatedAt)}</span>
                  </span>
                </a>
              {/each}
            {:else if open && !hasKids}
              <div class="border-t border-(--b1) px-4 py-2.5 pl-11 text-(--t5)">empty</div>
            {/if}
          </div>
        {/each}
      </div>

      {#if totalConversations === 0 && tree.length > 0}
        <p class="mt-4 text-sm text-(--t5)">No conversations yet. Open a workspace to start one.</p>
      {/if}
    {/if}

    {#if errorMsg}
      <div class="mt-4 border-l-2 border-red-500/50 pl-3 text-sm text-red-700 dark:text-red-300">
        {errorMsg}
      </div>
    {/if}
  </main>

  {#if showNewModal}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 z-100 flex items-center justify-center bg-black/50 px-4"
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
        class="w-full max-w-sm border border-(--b1) bg-(--bg) p-5"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
      >
        <h2 id="new-workspace-title" class="text-lg font-medium text-(--t1)">New workspace</h2>

        <label class="mt-4 block text-(--t3)">
          Name
          <input
            type="text"
            class="mt-1.5 block w-full rounded-xl border border-(--b1) bg-(--bg2) px-3 py-2.5 text-base text-(--t1) outline-none focus:border-(--accent)"
            placeholder="my-project"
            bind:value={newName}
          />
        </label>

        <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" class="w-full rounded-full sm:w-auto" onclick={() => (showNewModal = false)}>
            Cancel
          </Button>
          <Button type="button" class="w-full sm:w-auto" disabled={isCreating} onclick={createWorkspace}>
            {isCreating ? "Creating…" : "Create workspace"}
          </Button>
        </div>
      </div>
    </div>
  {/if}
</div>
