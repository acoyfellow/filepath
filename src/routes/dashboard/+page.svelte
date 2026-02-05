<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { signOut } from '$lib/auth-client';
  import { Button } from '$lib/components/ui/button';
  
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
      
      // Transform sessions to match expected format
      sessions = data.sessions.map(session => ({
        id: session.token, // Use token as ID for URL routing
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
      // Check user's credit balance before creating session
      const balanceResponse = await fetch('/api/billing/balance');
      if (!balanceResponse.ok) {
        throw new Error('Failed to check credit balance');
      }
      
      const balanceData = await balanceResponse.json() as { balance: number };
      
      // Check if user has at least $10 (1000 credits)
      if (balanceData.balance < 1000) {
        error = 'Insufficient credits. Please add credits to your account to create a session. Minimum $10 (1000 credits) required.';
        return;
      }
      
      // Call API to create a new session
      const sessionResponse = await fetch('/api/session', { method: 'POST' });
      
      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json().catch(() => ({})) as { message?: string };
        throw new Error(errorData.message || 'Failed to create session');
      }
      
      const sessionData = await sessionResponse.json() as { sessionId: string };
      
      // Navigate to the new session
      goto(`/session/${sessionData.sessionId}`);
    } catch (err) {
      console.error('Error creating session:', err);
      error = 'Failed to create session. Please try again.';
    }
  }
  
  async function signOutUser() {
    try {
      await signOut();
      goto('/');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  }
</script>

<svelte:head>
  <title>Dashboard - myfilepath.com</title>
</svelte:head>

<div class="min-h-screen bg-white">
  <!-- Header -->
  <header class="flex items-center justify-between p-4 border-b-4 border-black">
    <div class="flex items-center gap-4">
      <a href="/" class="px-4 py-2 text-xl font-black bg-black text-white border-4 border-black hover:bg-white hover:text-black">
        myfilepath.com
      </a>
    </div>
    
    <div class="flex items-center gap-2">
      <a
        href="/settings/api-keys"
        class="px-4 py-2 font-black border-4 border-black hover:bg-black hover:text-white"
      >
        API KEYS
      </a>
      <a
        href="/settings/billing"
        class="px-4 py-2 font-black border-4 border-black hover:bg-black hover:text-white"
      >
        BILLING
      </a>
      <!-- Passkey UI hidden for now - better UX needed -->
      <span class="px-3 py-2 font-mono text-sm border-4 border-black">{page.data.user?.email}</span>
      <button
        onclick={signOutUser}
        class="px-4 py-2 font-black border-4 border-black hover:bg-black hover:text-white"
      >
        SIGN OUT
      </button>
    </div>
  </header>
  
  <!-- Main Content -->
  <main class="p-8 max-w-6xl mx-auto">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-black">YOUR SESSIONS</h1>
        <p class="text-gray-600 mt-1">Manage your AI agent terminal sessions</p>
      </div>
      <Button onclick={createNewSession} class="px-6 py-3">
        + NEW SESSION
      </Button>
    </div>
    
    {#if error}
      <div class="bg-red-50 border-4 border-red-500 p-4 mb-6">
        <p class="text-red-700 font-bold">{error}</p>
      </div>
    {/if}
    
    {#if isLoading}
      <div class="text-center py-12">
        <div class="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="mt-4 text-gray-600">Loading sessions...</p>
      </div>
    {:else if sessions.length === 0}
      <div class="border-4 border-black p-12 text-center">
        <h3 class="text-2xl font-black mb-2">NO SESSIONS YET</h3>
        <p class="text-gray-600 mb-6">Create your first terminal session to get started</p>
        <Button onclick={createNewSession} class="px-6 py-3">
          CREATE YOUR FIRST SESSION
        </Button>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each sessions as session (session.id)}
          <div 
            class="border-4 border-black hover:bg-gray-50 cursor-pointer"
            role="button"
            tabindex="0"
            onclick={() => goto(`/session/${session.id}`)}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') goto(`/session/${session.id}`); }}
          >
            <div class="p-6">
              <div class="flex justify-between items-start mb-4">
                <h3 class="text-xl font-black">{session.name}</h3>
                <span class="w-3 h-3 bg-green-500 rounded-full"></span>
              </div>
              <div class="text-sm text-gray-600 space-y-1">
                <p>ID: {session.id}</p>
                <p>Created: {session.createdAt.toLocaleDateString()}</p>
                <p>Last active: {session.lastActive.toLocaleDateString()}</p>
              </div>
              <div class="mt-4 flex gap-2">
                <button 
                  class="text-xs font-black px-3 py-1 border-2 border-black hover:bg-black hover:text-white"
                  onclick={(e) => { e.stopPropagation(); goto(`/session/${session.id}`); }}
                >
                  OPEN
                </button>
                <button 
                  class="text-xs font-black px-3 py-1 border-2 border-black hover:bg-black hover:text-white"
                  onclick={(e) => { e.stopPropagation(); /* Share functionality */ }}
                >
                  SHARE
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
    
    <div class="mt-12 pt-8 border-t-4 border-black">
      <h2 class="text-2xl font-black mb-4">GETTING STARTED</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="border-4 border-black p-6">
          <h3 class="text-xl font-black mb-2">1. CREATE SESSION</h3>
          <p class="text-gray-700">Start a new terminal sandbox for your AI agent.</p>
        </div>
        <div class="border-4 border-black p-6">
          <h3 class="text-xl font-black mb-2">2. CONFIGURE AGENT</h3>
          <p class="text-gray-700">Set up API keys with secrets and budget caps.</p>
        </div>
        <div class="border-4 border-black p-6">
          <h3 class="text-xl font-black mb-2">3. RUN AGENT</h3>
          <p class="text-gray-700">Connect your agent to the terminal and watch it work.</p>
        </div>
      </div>
    </div>
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
  }
  
  :global(button) {
    border-radius: 0 !important;
  }
</style>