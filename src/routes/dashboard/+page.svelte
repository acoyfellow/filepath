<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { signOut } from '$lib/auth-client';
  import Nav from '$lib/components/Nav.svelte';
  
  interface DashboardSession {
    id: string;
    name: string;
    description?: string;
    type: 'legacy' | 'multi-agent';
    status: string;
    agentCount: number;
    createdAt: Date;
    lastActive: Date;
  }

  let sessions = $state<DashboardSession[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  
  onMount(async () => {
    try {
      // Fetch both legacy and multi-agent sessions in parallel
      const [legacyRes, multiRes] = await Promise.all([
        fetch('/api/session'),
        fetch('/api/session/multi/list'),
      ]);

      const allSessions: DashboardSession[] = [];

      if (legacyRes.ok) {
        const data = await legacyRes.json() as { sessions: Array<{ id: string; token: string; createdAt: string; updatedAt: string }> };
        for (const s of data.sessions) {
          allSessions.push({
            id: s.token,
            name: `Terminal ${s.token.substring(0, 8)}`,
            type: 'legacy',
            status: 'running',
            agentCount: 0,
            createdAt: new Date(s.createdAt),
            lastActive: new Date(s.updatedAt),
          });
        }
      }

      if (multiRes.ok) {
        const data = await multiRes.json() as { sessions: Array<{ id: string; name: string; description?: string; status: string; slotCount: number; createdAt: number; updatedAt: number }> };
        for (const s of data.sessions) {
          allSessions.push({
            id: s.id,
            name: s.name,
            description: s.description,
            type: 'multi-agent',
            status: s.status,
            agentCount: s.slotCount,
            createdAt: new Date(s.createdAt),
            lastActive: new Date(s.updatedAt),
          });
        }
      }

      // Sort by most recently active
      allSessions.sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime());
      sessions = allSessions;
      isLoading = false;
    } catch (err) {
      console.error('Error fetching sessions:', err);
      error = 'Failed to load sessions';
      isLoading = false;
    }
  });
  
  async function deleteSession(session: DashboardSession, event: MouseEvent) {
    event.stopPropagation();
    if (!confirm(`Delete session "${session.name}"? This cannot be undone.`)) return;

    try {
      const endpoint = session.type === 'multi-agent'
        ? `/api/session/multi?id=${encodeURIComponent(session.id)}`
        : `/api/session?id=${encodeURIComponent(session.id)}`;
      const res = await fetch(endpoint, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(data.message || 'Failed to delete session');
      }
      sessions = sessions.filter((s) => s.id !== session.id);
    } catch (err) {
      console.error('Error deleting session:', err);
      error = err instanceof Error ? err.message : 'Failed to delete session';
    }
  }

  async function createNewSession() {
    try {
      const balanceResponse = await fetch('/api/billing/balance');
      if (!balanceResponse.ok) {
        throw new Error('Failed to check credit balance');
      }
      
      const balanceData = await balanceResponse.json() as { balance: number };
      
      if (balanceData.balance < 1) {
        error = 'Insufficient credits. Please add credits to your account to create a session.';
        return;
      }
      
      const sessionResponse = await fetch('/api/session', { method: 'POST' });
      
      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json().catch(() => ({})) as { message?: string };
        throw new Error(errorData.message || 'Failed to create session');
      }
      
      const sessionData = await sessionResponse.json() as { sessionId: string };
      goto(`/session/${sessionData.sessionId}`);
    } catch (err) {
      console.error('Error creating session:', err);
      error = 'Failed to create session. Please try again.';
    }
  }
</script>

<svelte:head>
  <title>Dashboard - myfilepath.com</title>
</svelte:head>

<div class="min-h-screen bg-neutral-950 text-neutral-300">
  <Nav variant="dashboard" email={page.data.user?.email} />
  
  <main class="max-w-4xl mx-auto px-6 py-12">
    <!-- Header -->
    <div class="flex items-center justify-between mb-10">
      <div>
        <h1 class="text-neutral-100 text-xl font-medium mb-1">Your sessions</h1>
        <p class="text-sm text-neutral-500">Manage your agent execution environments</p>
      </div>
      <div class="flex items-center gap-3">
        <button
          onclick={() => goto('/session/new')}
          class="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded hover:bg-emerald-500 transition-colors cursor-pointer"
        >
          + new session
        </button>
        <button
          onclick={createNewSession}
          class="px-4 py-2 text-sm font-medium bg-neutral-800 text-neutral-300 border border-neutral-700 rounded hover:bg-neutral-700 transition-colors cursor-pointer"
        >
          quick terminal
        </button>
      </div>
    </div>
    
    {#if error}
      <div class="bg-red-950/50 border border-red-800 rounded p-4 mb-6">
        <p class="text-red-400 text-sm">{error}</p>
      </div>
    {/if}
    
    {#if isLoading}
      <div class="text-center py-16">
        <div class="w-6 h-6 border-2 border-neutral-700 border-t-neutral-400 rounded-full animate-spin mx-auto"></div>
        <p class="mt-4 text-neutral-500 text-sm">Loading sessions...</p>
      </div>
    {:else if sessions.length === 0}
      <div class="border border-neutral-800 rounded p-12 text-center">
        <p class="text-neutral-400 mb-1">No sessions yet</p>
        <p class="text-neutral-600 text-sm mb-6">Create your first execution environment to get started</p>
        <button
          onclick={createNewSession}
          class="px-4 py-2 text-sm font-medium bg-neutral-100 text-neutral-950 rounded hover:bg-white transition-colors cursor-pointer"
        >
          create your first session
        </button>
      </div>
    {:else}
      <div class="space-y-3">
        {#each sessions as session (session.id)}
          <div 
            class="bg-neutral-900 border border-neutral-800 rounded p-5 hover:border-neutral-700 transition-colors cursor-pointer group"
            role="button"
            tabindex="0"
            onclick={() => goto(`/session/${session.id}`)}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') goto(`/session/${session.id}`); }}
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <span class="w-2 h-2 rounded-full {session.status === 'running' ? 'bg-emerald-500' : session.status === 'stopped' ? 'bg-neutral-500' : session.status === 'error' ? 'bg-red-500' : 'bg-amber-500'}"></span>
                <h3 class="text-neutral-100 font-medium">{session.name}</h3>
                {#if session.type === 'multi-agent'}
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                    {session.agentCount} agent{session.agentCount !== 1 ? 's' : ''}
                  </span>
                {:else}
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-500 border border-neutral-700 font-mono">terminal</span>
                {/if}
              </div>
              <div class="flex items-center gap-2">
                {#if session.type === 'multi-agent' && (session.status === 'draft' || session.status === 'stopped')}
                  <button
                    onclick={(e: MouseEvent) => deleteSession(session, e)}
                    class="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/50 rounded transition-all cursor-pointer"
                    title="Delete session"
                  >
                    ✕ delete
                  </button>
                {/if}
                <span class="text-neutral-600 text-xs font-mono group-hover:text-neutral-400 transition-colors">open →</span>
              </div>
            </div>
            {#if session.description}
              <p class="mt-2 ml-5 text-sm text-neutral-500 line-clamp-1">{session.description}</p>
            {/if}
            <div class="mt-2 ml-5 flex gap-6 text-xs text-neutral-500 font-mono">
              <span>{session.id.substring(0, 16)}…</span>
              <span>created {session.createdAt.toLocaleDateString()}</span>
              <span>active {session.lastActive.toLocaleDateString()}</span>
            </div>
          </div>
        {/each}
      </div>
    {/if}
    
    <!-- Getting Started -->
    <section class="mt-16 pt-8 border-t border-neutral-800">
      <h2 class="text-neutral-500 text-xs uppercase tracking-wide mb-6">Getting started</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-neutral-900 border border-neutral-800 rounded p-5">
          <p class="text-neutral-500 text-xs font-mono mb-2">01</p>
          <h3 class="text-neutral-200 font-medium text-sm mb-2">Create session</h3>
          <p class="text-neutral-500 text-sm">Start a new container for your AI agent.</p>
        </div>
        <div class="bg-neutral-900 border border-neutral-800 rounded p-5">
          <p class="text-neutral-500 text-xs font-mono mb-2">02</p>
          <h3 class="text-neutral-200 font-medium text-sm mb-2">Configure agent</h3>
          <p class="text-neutral-500 text-sm">Set up API keys with secrets and budget caps.</p>
        </div>
        <div class="bg-neutral-900 border border-neutral-800 rounded p-5">
          <p class="text-neutral-500 text-xs font-mono mb-2">03</p>
          <h3 class="text-neutral-200 font-medium text-sm mb-2">Run agent</h3>
          <p class="text-neutral-500 text-sm">Connect your agent and watch it execute.</p>
        </div>
      </div>
    </section>
  </main>
</div>
