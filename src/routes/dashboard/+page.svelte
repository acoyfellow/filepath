<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import StatusDot from "$lib/components/shared/StatusDot.svelte";
  import type { SessionStatus } from "$lib/types/session";
  import type { AgentStatus } from "$lib/protocol";
  
  interface SessionItem {
    id: string;
    name: string;
    status: SessionStatus;
    gitRepoUrl?: string;
    nodeCount: number;
    createdAt: number;
    updatedAt: number;
  }

  let sessions = $state<SessionItem[]>([]);
  let isLoading = $state(true);
  let errorMsg = $state<string | null>(null);

  // New session modal
  let showNewModal = $state(false);
  let newName = $state("");
  let newGitUrl = $state("");
  let isCreating = $state(false);

  onMount(async () => {
    try {
      const res = await fetch("/api/sessions");
      if (!res.ok) throw new Error("Failed to load sessions");
      const data = (await res.json()) as { sessions: SessionItem[] };
      sessions = data.sessions;
    } catch (err) {
      errorMsg =
        err instanceof Error ? err.message : "Failed to load sessions";
    } finally {
      isLoading = false;
    }
  });

  async function createSession() {
    isCreating = true;
    errorMsg = null;
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim() || undefined,
          gitRepoUrl: newGitUrl.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create session");
      const data = (await res.json()) as { id: string };
      goto(`/session/${data.id}`);
    } catch (err) {
      errorMsg =
        err instanceof Error ? err.message : "Failed to create session";
      isCreating = false;
    }
  }

  async function deleteSession(id: string, name: string, e: MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      sessions = sessions.filter((s) => s.id !== id);
    } catch (err) {
      errorMsg =
        err instanceof Error ? err.message : "Failed to delete session";
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

  function toAgentStatus(status: SessionStatus): AgentStatus {
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

<svelte:head>
  <title>Dashboard - filepath</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link
    href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@400;500;600&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="dashboard min-h-screen font-sans bg-gray-50 text-gray-700 dark:bg-neutral-950 dark:text-neutral-300 transition-colors duration-200">
  <main class="main">
    <div class="header-row">
      <div>
        <h1 class="title">Sessions</h1>
        <p class="subtitle">Your agent orchestration environments</p>
      </div>
      <button class="px-4 py-2 text-xs font-medium rounded-md transition-colors bg-blue-600 hover:bg-blue-500 text-white dark:bg-indigo-500 dark:hover:bg-indigo-400" onclick={openNewModal}>+ New session</button>
    </div>

    {#if errorMsg}
      <div class="error-banner">{errorMsg}</div>
    {/if}

    {#if isLoading}
      <div class="empty-state">
        <div class="spinner"></div>
        <p>Loading sessions...</p>
      </div>
    {:else if sessions.length === 0}
      <div class="empty-state">
        <p class="empty-title">No sessions yet</p>
        <p class="empty-sub">Create your first session to start orchestrating agents</p>
        <button class="px-4 py-2 text-xs font-medium rounded-md transition-colors bg-blue-600 hover:bg-blue-500 text-white dark:bg-indigo-500 dark:hover:bg-indigo-400" onclick={openNewModal}>Create first session</button>
      </div>
    {:else}
      <div class="session-list">
        {#each sessions as s (s.id)}
          <div
            class="group rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50 p-4 cursor-pointer transition-colors hover:border-gray-300 dark:hover:border-neutral-700"
            role="button"
            tabindex="0"
            onclick={() => goto(`/session/${s.id}`)}
            onkeydown={(e) => { if (e.key === "Enter") goto(`/session/${s.id}`); }}
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <StatusDot status={toAgentStatus(s.status)} size={8} />
                <span class="text-sm font-medium text-gray-900 dark:text-neutral-200">{s.name}</span>
                <span class="text-xs px-1.5 py-0.5 rounded border text-gray-600 dark:text-neutral-400 border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/50">{s.nodeCount} agent{s.nodeCount !== 1 ? "s" : ""}</span>
              </div>
              <div class="flex items-center gap-3">
                {#if s.status === "draft" || s.status === "stopped"}
                  <button
                    class="text-xs text-red-500 dark:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    onclick={(e) => deleteSession(s.id, s.name, e)}
                  >delete</button>
                {/if}
                <span class="text-xs text-gray-400 dark:text-neutral-500">open &rarr;</span>
              </div>
            </div>
            <div class="flex gap-4 mt-2 pl-4 text-xs text-gray-400 dark:text-neutral-500">
              <span>{s.id.slice(0, 12)}</span>
              <span>{s.status}</span>
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
    <div class="modal-overlay" onclick={() => (showNewModal = false)} onkeydown={() => {}}>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-6 w-[400px] max-w-[90vw]" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
        <h2 class="text-base font-semibold text-gray-900 dark:text-neutral-100 mb-5">New session</h2>

        <label class="block text-xs text-gray-500 dark:text-neutral-500 mb-3.5">
          Name
          <input type="text" class="block w-full mt-1.5 px-2.5 py-2 text-xs font-mono bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 border border-gray-200 dark:border-neutral-800 rounded-md outline-none focus:border-blue-500 dark:focus:border-indigo-500" placeholder="my-project" bind:value={newName} />
        </label>

        <label class="block text-xs text-gray-500 dark:text-neutral-500 mb-3.5">
          Git repo URL <span class="text-gray-400 dark:text-neutral-600">(optional)</span>
          <input type="text" class="block w-full mt-1.5 px-2.5 py-2 text-xs font-mono bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 border border-gray-200 dark:border-neutral-800 rounded-md outline-none focus:border-blue-500 dark:focus:border-indigo-500" placeholder="https://github.com/user/repo" bind:value={newGitUrl} />
        </label>

        <div class="flex justify-end gap-2 mt-5">
          <button class="px-4 py-2 text-xs font-medium rounded-md border transition-colors bg-white border-gray-300 hover:border-gray-400 text-gray-700 dark:bg-neutral-800 dark:border-neutral-700 dark:hover:border-neutral-600 dark:text-neutral-300" onclick={() => (showNewModal = false)}>Cancel</button>
          <button class="px-4 py-2 text-xs font-medium rounded-md transition-colors disabled:opacity-50 bg-blue-600 hover:bg-blue-500 text-white dark:bg-indigo-500 dark:hover:bg-indigo-400" disabled={isCreating} onclick={createSession}>
            {isCreating ? "Creating..." : "Create & spawn agent"}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .main { max-width: 720px; margin: 0 auto; padding: 48px 24px; }
  .header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; }
  .title { font-size: 18px; font-weight: 600; margin: 0; }
  .subtitle { font-size: 12px; margin: 4px 0 0; }
  .error-banner { padding: 10px 14px; font-size: 12px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 6px; color: #f87171; margin-bottom: 16px; }
  .empty-state { text-align: center; padding: 64px 0; }
  .spinner { width: 20px; height: 20px; border: 2px solid rgb(229 231 235); border-top-color: rgb(156 163 175); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 12px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .session-list { display: flex; flex-direction: column; gap: 8px; }
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100; }
</style>
