<script lang="ts">
  import { onMount } from 'svelte';
  import { goto, afterNavigate } from '$app/navigation';
  import { page } from '$app/stores';
  import { signOut } from '$lib/auth-client';
  import { get } from 'svelte/store';
  
  // Get session ID from URL
  let sessionId = $state('');
  
  // Session state
  let tabs = $state<Array<{id: string, name: string}>>([
    { id: 'tab1', name: 'Terminal 1' }
  ]);
  let activeTabId = $state('tab1');
  let terminalStatus = $state<Record<string, string>>({
    tab1: 'ready'
  });
  let ws: WebSocket | null = null;
  
  // Terminal iframe refs
  let iframeRefs = $state<Record<string, HTMLIFrameElement | null>>({});
  
  onMount(() => {
    // Get session ID from page store
    sessionId = get(page).params.id || '';
    
    if (!sessionId) {
      goto('/dashboard');
      return;
    }
    
    // Initialize session
    initSession();
    
    // Handle navigation away from page
    const unsubscribe = afterNavigate(() => {
      if (ws) ws.close();
    });
    
    return () => {
      unsubscribe();
      if (ws) ws.close();
    };
  });
  
  async function initSession() {
    // In a real implementation, we would connect to the session DO
    // For now, we'll just initialize with default values
    
    // Connect WebSocket for real-time updates
    connectWebSocket();
    
    // Start first terminal
    await startTerminal(activeTabId);
  }
  
  function connectWebSocket() {
    // In a real implementation, we would connect to the session DO WebSocket
    // For now, we'll just simulate the connection
    console.log(`Connecting to WebSocket for session ${sessionId}`);
    
    // Simulate connection success
    setTimeout(() => {
      console.log('WebSocket connected');
    }, 1000);
  }
  
  function startTerminal(tabId: string) {
    // Terminal start is handled by the terminal HTML page itself
    // Just mark as ready so the iframe is shown
    terminalStatus[tabId] = 'ready';
  }
  
  async function addTab() {
    const newTabId = `tab${tabs.length + 1}`;
    const newTab = { id: newTabId, name: `Terminal ${tabs.length + 1}` };
    
    tabs = [...tabs, newTab];
    activeTabId = newTabId;
    
    await startTerminal(newTabId);
  }
  
  async function closeTab(tabId: string) {
    if (tabs.length <= 1) return; // Keep at least one tab
    
    tabs = tabs.filter(tab => tab.id !== tabId);
    
    // If we closed the active tab, switch to the first tab
    if (activeTabId === tabId) {
      activeTabId = tabs[0]?.id || '';
    }
  }
  
  async function switchTab(tabId: string) {
    activeTabId = tabId;
    
    // Start terminal if not already running
    if (!terminalStatus[tabId] || terminalStatus[tabId] === 'error') {
      await startTerminal(tabId);
    }
  }
  
  function getTerminalUrl(tabId: string): string {
    // Point to terminal HTML page served by worker
    // Format: /terminal/{sessionId}/tab?tab={tabId}
    return `/terminal/${sessionId}/tab?tab=${tabId}`;
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
  <title>Session {sessionId} - myfilepath.com</title>
</svelte:head>

<div class="h-screen flex flex-col bg-white">
  <!-- Header -->
  <header class="flex items-center justify-between p-4 border-b-4 border-black">
    <div class="flex items-center gap-4">
      <a href="/dashboard" class="px-4 py-2 text-xl font-black bg-black text-white border-4 border-black hover:bg-white hover:text-black">
        ← DASHBOARD
      </a>
      <span class="px-3 py-1 font-mono text-sm border-4 border-black bg-white">
        SESSION: {sessionId}
      </span>
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
      <span class="px-3 py-2 font-mono text-sm border-4 border-black">{($page).data?.user?.email || 'User'}</span>
      <button
        onclick={signOutUser}
        class="px-4 py-2 font-black border-4 border-black hover:bg-black hover:text-white"
      >
        SIGN OUT
      </button>
    </div>
  </header>
  
  <!-- Tabs -->
  <div class="flex items-center gap-0 px-4 border-b-4 border-black bg-white">
    {#each tabs as tab (tab.id)}
      <button
        onclick={() => switchTab(tab.id)}
        class="flex items-center gap-2 px-4 py-2 font-black border-4 border-black border-b-0 -mb-1
          {activeTabId === tab.id ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-100'}"
      >
        <span>{tab.name.toUpperCase()}</span>
        {#if terminalStatus[tab.id] === 'starting'}
          <span class="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
        {:else if terminalStatus[tab.id] === 'ready'}
          <span class="w-3 h-3 bg-green-500"></span>
        {:else if terminalStatus[tab.id] === 'error'}
          <span class="w-3 h-3 bg-red-500"></span>
        {:else}
          <span class="w-3 h-3 bg-gray-400"></span>
        {/if}
        {#if tabs.length > 1}
          <span
            role="button"
            tabindex="0"
            onclick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
            onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); closeTab(tab.id); } }}
            class="ml-1 hover:bg-white hover:text-black px-1 cursor-pointer"
          >
            ×
          </span>
        {/if}
      </button>
    {/each}
    <button
      onclick={addTab}
      class="px-4 py-2 font-black text-xl border-4 border-black border-b-0 -mb-1 bg-white hover:bg-black hover:text-white"
    >
      +
    </button>
  </div>
  
  <!-- Terminal Area -->
  <div class="flex-1 relative bg-black">
    {#each tabs as tab (tab.id)}
      <div
        class="absolute inset-0 {activeTabId === tab.id ? 'block' : 'hidden'}"
      >
        {#if terminalStatus[tab.id] === 'ready'}
          <iframe
            bind:this={iframeRefs[tab.id]}
            src={getTerminalUrl(tab.id)}
            class="w-full h-full border-0"
            title="Terminal {tab.name}"
          ></iframe>
        {:else if terminalStatus[tab.id] === 'starting'}
          <div class="flex items-center justify-center h-full">
            <div class="text-center">
              <div class="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mb-4 mx-auto"></div>
              <p class="text-white font-black text-xl">STARTING TERMINAL...</p>
              <p class="text-gray-500 font-mono text-sm mt-2">This may take a moment</p>
            </div>
          </div>
        {:else if terminalStatus[tab.id] === 'error'}
          <div class="flex items-center justify-center h-full">
            <div class="text-center border-4 border-red-500 p-8 bg-white">
              <p class="text-red-500 font-black text-xl mb-4">TERMINAL FAILED</p>
              <button
                onclick={() => startTerminal(tab.id)}
                class="px-6 py-3 font-black border-4 border-black hover:bg-black hover:text-white"
              >
                RETRY
              </button>
            </div>
          </div>
        {:else}
          <div class="flex items-center justify-center h-full">
            <p class="text-gray-500 font-mono">Initializing...</p>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
  
  :global(input) {
    border-radius: 0 !important;
  }
</style>