<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { signOut } from '$lib/auth-client';
  import { Button } from '$lib/components/ui/button';
  
  let sessions = $state([
    { id: 'session-1', name: 'Research Project', createdAt: new Date(), lastActive: new Date() },
    { id: 'session-2', name: 'Code Analysis', createdAt: new Date(Date.now() - 86400000), lastActive: new Date(Date.now() - 3600000) },
  ]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  
  onMount(() => {
    // In a real implementation, we would fetch sessions from the API
    // For now, we'll just simulate with static data
    setTimeout(() => {
      isLoading = false;
    }, 500);
  });
  
  async function createNewSession() {
    // In a real implementation, we would call an API to create a new session
    const newSessionId = 'session-' + (sessions.length + 1);
    const newSession = {
      id: newSessionId,
      name: 'New Session ' + (sessions.length + 1),
      createdAt: new Date(),
      lastActive: new Date()
    };
    
    sessions = [newSession, ...sessions];
    
    // Navigate to the new session
    goto(`/session/${newSessionId}`);
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
      <a
        href="/settings/passkey"
        class="px-4 py-2 font-black border-4 border-black hover:bg-black hover:text-white"
      >
        PASSKEY
      </a>
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
            on:click={() => goto(`/session/${session.id}`)}
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