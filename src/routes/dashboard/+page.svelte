<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import StatusDot from "$lib/components/shared/StatusDot.svelte";

  interface SessionItem {
    id: string;
    name: string;
    status: string;
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
</script>

<svelte:head>
  <title>Dashboard - filepath</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link
    href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@400;500;600&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="dashboard dark">
  <header class="topbar">
    <div class="topbar-left">
      <span class="logo">filepath</span>
    </div>
    <div class="topbar-right">
      <span class="user-email">{page.data.user?.email ?? ""}</span>
      <a href="/settings" class="nav-link">Settings</a>
    </div>
  </header>

  <main class="main">
    <div class="header-row">
      <div>
        <h1 class="title">Sessions</h1>
        <p class="subtitle">Your agent orchestration environments</p>
      </div>
      <button class="btn-primary" onclick={openNewModal}>+ New session</button>
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
        <button class="btn-primary" onclick={openNewModal}>Create first session</button>
      </div>
    {:else}
      <div class="session-list">
        {#each sessions as s (s.id)}
          <div
            class="session-card"
            role="button"
            tabindex="0"
            onclick={() => goto(`/session/${s.id}`)}
            onkeydown={(e) => { if (e.key === "Enter") goto(`/session/${s.id}`); }}
          >
            <div class="session-row">
              <div class="session-info">
                <StatusDot status={s.status} size={8} />
                <span class="session-name">{s.name}</span>
                <span class="session-badge">{s.nodeCount} agent{s.nodeCount !== 1 ? "s" : ""}</span>
              </div>
              <div class="session-actions">
                {#if s.status === "draft" || s.status === "stopped"}
                  <button
                    class="btn-delete"
                    onclick={(e) => deleteSession(s.id, s.name, e)}
                  >delete</button>
                {/if}
                <span class="session-arrow">open &rarr;</span>
              </div>
            </div>
            <div class="session-meta">
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
      <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
        <h2 class="modal-title">New session</h2>

        <label class="field-label">
          Name
          <input type="text" class="field-input" placeholder="my-project" bind:value={newName} />
        </label>

        <label class="field-label">
          Git repo URL <span class="optional">(optional)</span>
          <input type="text" class="field-input" placeholder="https://github.com/user/repo" bind:value={newGitUrl} />
        </label>

        <div class="modal-buttons">
          <button class="btn-secondary" onclick={() => (showNewModal = false)}>Cancel</button>
          <button class="btn-primary" disabled={isCreating} onclick={createSession}>
            {isCreating ? "Creating..." : "Create & spawn agent"}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .dashboard {
    --bg: #09090b; --bg3: #111114; --b1: #1a1a1e; --b2: #27272a;
    --t1: #e4e4e7; --t2: #a1a1aa; --t3: #71717a; --t4: #52525b;
    --accent: #818cf8; --red: #ef4444;
    --mono: "JetBrains Mono", monospace; --sans: "Outfit", sans-serif;
    min-height: 100vh; background: var(--bg); color: var(--t2); font-family: var(--mono);
  }
  .topbar { display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; border-bottom: 1px solid var(--b1); }
  .topbar-left { display: flex; align-items: center; gap: 12px; }
  .topbar-right { display: flex; align-items: center; gap: 16px; font-size: 12px; }
  .logo { font-family: var(--sans); font-weight: 600; font-size: 16px; color: var(--t1); }
  .user-email { color: var(--t3); }
  .nav-link { color: var(--t3); text-decoration: none; }
  .nav-link:hover { color: var(--t2); }
  .main { max-width: 720px; margin: 0 auto; padding: 48px 24px; }
  .header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; }
  .title { font-family: var(--sans); font-size: 18px; font-weight: 600; color: var(--t1); margin: 0; }
  .subtitle { font-size: 12px; color: var(--t3); margin: 4px 0 0; }
  .btn-primary { padding: 8px 16px; font-size: 12px; font-family: var(--mono); background: var(--accent); color: #fff; border: none; border-radius: 6px; cursor: pointer; }
  .btn-primary:hover { filter: brightness(1.1); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-secondary { padding: 8px 16px; font-size: 12px; font-family: var(--mono); background: var(--bg3); color: var(--t2); border: 1px solid var(--b1); border-radius: 6px; cursor: pointer; }
  .btn-secondary:hover { border-color: var(--b2); }
  .error-banner { padding: 10px 14px; font-size: 12px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 6px; color: #f87171; margin-bottom: 16px; }
  .empty-state { text-align: center; padding: 64px 0; }
  .empty-title { font-size: 14px; color: var(--t2); margin: 0 0 4px; }
  .empty-sub { font-size: 12px; color: var(--t4); margin: 0 0 24px; }
  .spinner { width: 20px; height: 20px; border: 2px solid var(--b2); border-top-color: var(--t3); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 12px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .session-list { display: flex; flex-direction: column; gap: 8px; }
  .session-card { background: var(--bg3); border: 1px solid var(--b1); border-radius: 8px; padding: 14px 16px; cursor: pointer; transition: border-color 0.15s; }
  .session-card:hover { border-color: var(--b2); }
  .session-row { display: flex; align-items: center; justify-content: space-between; }
  .session-info { display: flex; align-items: center; gap: 10px; }
  .session-name { color: var(--t1); font-weight: 500; font-size: 13px; }
  .session-badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: rgba(129,140,248,0.1); color: var(--accent); border: 1px solid rgba(129,140,248,0.2); }
  .session-actions { display: flex; align-items: center; gap: 8px; }
  .btn-delete { font-size: 10px; font-family: var(--mono); color: var(--red); background: none; border: none; cursor: pointer; opacity: 0; transition: opacity 0.15s; }
  .session-card:hover .btn-delete { opacity: 1; }
  .session-arrow { font-size: 11px; color: var(--t4); }
  .session-meta { display: flex; gap: 16px; margin-top: 6px; padding-left: 18px; font-size: 10px; color: var(--t4); }
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100; }
  .modal { background: var(--bg3); border: 1px solid var(--b1); border-radius: 12px; padding: 24px; width: 400px; max-width: 90vw; }
  .modal-title { font-family: var(--sans); font-size: 16px; font-weight: 600; color: var(--t1); margin: 0 0 20px; }
  .field-label { display: block; font-size: 11px; color: var(--t3); margin-bottom: 14px; }
  .optional { color: var(--t4); }
  .field-input { display: block; width: 100%; margin-top: 6px; padding: 8px 10px; font-size: 12px; font-family: var(--mono); background: var(--bg); color: var(--t1); border: 1px solid var(--b1); border-radius: 6px; outline: none; box-sizing: border-box; }
  .field-input:focus { border-color: var(--accent); }
  .modal-buttons { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
</style>
