<script lang="ts">
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import Button from "$lib/components/ui/button/button.svelte";
  import SEO from "$lib/components/SEO.svelte";
  import StatusDot from "$lib/components/shared/StatusDot.svelte";
  import StatusGlyph from "$lib/components/shared/StatusGlyph.svelte";
  import type { WorkspaceStatus } from "$lib/types/workspace";
  import type { AgentStatus } from "$lib/protocol";
  
  interface WorkspaceItem {
    id: string;
    name: string;
    status: WorkspaceStatus;
    gitRepoUrl?: string;
    agentCount: number;
    createdAt: number;
    updatedAt: number;
  }

  let workspaces = $state<WorkspaceItem[]>([]);
  let isLoading = $state(true);
  let errorMsg = $state<string | null>(null);

  // New workspace modal
  let showNewModal = $state(false);
  let newName = $state("");
  let newGitUrl = $state("");
  let isCreating = $state(false);

  onMount(async () => {
    try {
      const res = await fetch("/api/workspaces");
      if (!res.ok) throw new Error("Failed to load workspaces");
      const data = (await res.json()) as { workspaces: WorkspaceItem[] };
      workspaces = data.workspaces;
    } catch (err) {
      errorMsg =
        err instanceof Error ? err.message : "Failed to load workspaces";
    } finally {
      isLoading = false;
    }
  });

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
        }),
      });
      if (!res.ok) throw new Error("Failed to create workspace");
      const data = (await res.json()) as { id: string };
      goto(`/workspace/${data.id}`);
    } catch (err) {
      errorMsg =
        err instanceof Error ? err.message : "Failed to create workspace";
    } finally {
      isCreating = false;
    }
  }

  async function deleteWorkspace(id: string, name: string, e: MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/workspaces/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      workspaces = workspaces.filter((s) => s.id !== id);
    } catch (err) {
      errorMsg =
        err instanceof Error ? err.message : "Failed to delete workspace";
    }
  }

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  function openNewModal() {
    newName = "";
    newGitUrl = "";
    showNewModal = true;
  }

  function toAgentStatus(status: WorkspaceStatus): AgentStatus {
    switch (status) {
      case "running":
        return "running";
      case "error":
        return "error";
      case "paused":
        return "thinking";
      case "stopped":
        return "done";
      case "draft":
      default:
        return "idle";
    }
  }
</script>

<SEO
  title="Dashboard | filepath"
  description="Manage your workspaces and launch bounded background agents from your filepath dashboard."
  keywords="filepath dashboard, workspaces, agents"
  path="/dashboard"
  type="website"
  section="Dashboard"
  tags="dashboard,workspaces,agents"
  noindex
  breadcrumbs={[{ name: "Dashboard", item: "/dashboard" }]}
/>

<div class="min-h-screen bg-(--bg2) font-(family-name:--f) text-(--t2) transition-colors duration-200">
  <main class="mx-auto flex w-full max-w-3xl flex-col px-6 py-12 max-[640px]:px-4 max-[640px]:py-8">
    <div class="mb-8 flex items-start justify-between gap-4 max-[640px]:mb-6 max-[640px]:flex-col max-[640px]:items-stretch">
      <div>
        <h1 class="text-2xl font-[650] tracking-[-0.03em] text-(--t1)">Workspaces</h1>
        <p class="mt-1.5 max-w-2xl text-sm leading-6 text-(--t4)">
          Your personal background agents, each scoped to a sandboxed repo clone.
        </p>
      </div>
      <Button
        class="h-10 gap-2 rounded-full bg-(--accent) px-4 text-white shadow-none hover:opacity-90 max-[640px]:w-full"
        onclick={openNewModal}
      >
        <PlusIcon size={15} />
        <span>New workspace</span>
      </Button>
    </div>

    {#if errorMsg}
      <div class="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300">
        {errorMsg}
      </div>
    {/if}

    {#if isLoading}
      <div class="py-16 text-center">
        <div class="mx-auto mb-3 size-5 animate-spin rounded-full border-2 border-(--b1) border-t-(--accent)"></div>
        <p>Loading workspaces...</p>
      </div>
    {:else if workspaces.length === 0}
      <div class="py-16 text-center">
        <p class="text-lg font-[620] text-(--t1)">No workspaces yet</p>
        <p class="mx-auto mt-2 max-w-md text-sm leading-7 text-(--t4)">
          Create your first workspace, connect a repo, and start bounded background agents.
        </p>
        <Button
          class="mt-5 h-10 gap-2 rounded-full bg-(--accent) px-4 text-white shadow-none hover:opacity-90"
          onclick={openNewModal}
        >
          <PlusIcon size={15} />
          <span>Create first workspace</span>
        </Button>
      </div>
    {:else}
      <div class="flex flex-col gap-2">
        {#each workspaces as s (s.id)}
          <div
            class="group cursor-pointer rounded-xl border border-(--b1) bg-(--bg) p-4 transition-colors hover:border-(--b2)"
            role="button"
            tabindex="0"
            onclick={() => goto(`/workspace/${s.id}`)}
            onkeydown={(e) => { if (e.key === "Enter") goto(`/workspace/${s.id}`); }}
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <StatusDot status={toAgentStatus(s.status)} size={8} />
                <span class="text-sm font-medium text-(--t1)">{s.name}</span>
                <span class="rounded-full border border-(--b1) bg-(--bg2) px-2 py-0.5 text-[11px] text-(--t4)">
                  {s.agentCount} agent{s.agentCount !== 1 ? "s" : ""}
                </span>
              </div>
              <div class="flex items-center gap-3">
                {#if s.status === "draft" || s.status === "stopped"}
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    class="size-8 rounded-full border border-red-500/30 bg-red-500/10 text-red-700 opacity-0 shadow-none transition-opacity hover:bg-red-500/15 hover:text-red-800 group-hover:opacity-100 dark:text-red-300 dark:hover:text-red-100"
                    aria-label={`Delete workspace ${s.name}`}
                    title={`Delete workspace ${s.name}`}
                    onclick={(e) => deleteWorkspace(s.id, s.name, e)}
                  >
                    <Trash2Icon size={14} />
                  </Button>
                {/if}
                <span class="inline-flex items-center justify-center text-(--t5)">
                  <ArrowRightIcon size={14} />
                </span>
              </div>
            </div>
            <div class="mt-2 flex flex-wrap gap-4 pl-4 text-xs text-(--t5)">
              <span>{s.id.slice(0, 12)}</span>
              <span class="inline-flex items-center" title={s.status}>
                <StatusGlyph status={toAgentStatus(s.status)} compact />
              </span>
              <span>created {formatDate(s.createdAt)}</span>
              <span>updated {formatDate(s.updatedAt)}</span>
            </div>
          </div>
        {/each}
      </div>
    {/if}
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
      onkeydown={(e) => { if (e.key === "Escape") showNewModal = false; }}
    >
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="w-full max-w-[400px] rounded-2xl border border-(--b1) bg-(--bg) p-6 shadow-(--shadow)" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
        <h2 id="new-workspace-title" class="mb-5 text-lg font-semibold tracking-tight text-(--t1)">New workspace</h2>

        <label class="mb-3.5 block text-sm font-medium text-(--t4)">
          Name
          <input type="text" class="mt-1.5 block w-full rounded-xl border border-(--b1) bg-(--bg2) px-3 py-2.5 text-sm text-(--t1) outline-none focus:border-(--accent)" placeholder="my-project" bind:value={newName} />
        </label>

        <label class="mb-3.5 block text-sm font-medium text-(--t4)">
          Git repo URL <span class="text-(--t5)">(optional)</span>
          <input type="text" class="mt-1.5 block w-full rounded-xl border border-(--b1) bg-(--bg2) px-3 py-2.5 text-sm text-(--t1) outline-none focus:border-(--accent)" placeholder="https://github.com/user/repo" bind:value={newGitUrl} />
        </label>

        <div class="flex justify-end gap-2 mt-5">
          <Button variant="outline" onclick={() => (showNewModal = false)}>Cancel</Button>
          <Button class="bg-(--accent) text-white shadow-none hover:opacity-90" disabled={isCreating} onclick={createWorkspace}>
            {isCreating ? "Creating..." : "Create workspace"}
          </Button>
        </div>
      </div>
    </div>
  {/if}
</div>
