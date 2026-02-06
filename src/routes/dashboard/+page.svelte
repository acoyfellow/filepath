<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { signOut } from '$lib/auth-client';
  import Nav from '$lib/components/Nav.svelte';
  
  let sessions = $state<Array<{ id: string; name: string; createdAt: Date; lastActive: Date }>>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  
  onMount(async () => {
    try {
      const response = await fetch('/api/session');
      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }
      
      const data = await response.json() as { sessions: Array<{ id: string; token: string; createdAt: string; updatedAt: string }> };
      
      sessions = data.sessions.map(session => ({
        id: session.token,
        name: `Session ${session.token.substring(0, 8)}`,
        createdAt: new Date(session.createdAt),
        lastActive: new Date(session.updatedAt)
      }));
      
      isLoading = false;
    } catch (err) {
      console.error('Error fetching sessions:', err);
      error = 'Failed to load sessions';
      isLoading = false;
    }
  });
  
  async function createNewSession() {
    try {
      const balanceResponse = await fetch('/api/billing/balance');
      if (!balanceResponse.ok) {
        throw new Error('Failed to check credit balance');
      }
      
      const balanceData = await balanceResponse.json() as { balance: number };
      
      if (balanceData.balance < 1000) {
        error = 'Insufficient credits. Please add credits to your account to create a session. Minimum $10 (1000 credits) required.';
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
      <button
        onclick={createNewSession}
        class="px-4 py-2 text-sm font-medium bg-neutral-100 text-neutral-950 rounded hover:bg-white transition-colors cursor-pointer"
      >
        + new session
      </button>
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
                <span class="w-2 h-2 bg-emerald-500 rounded-full"></span>
                <h3 class="text-neutral-100 font-medium">{session.name}</h3>
              </div>
              <span class="text-neutral-600 text-xs font-mono group-hover:text-neutral-400 transition-colors">open →</span>
            </div>
            <div class="mt-3 ml-5 flex gap-6 text-xs text-neutral-500 font-mono">
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
