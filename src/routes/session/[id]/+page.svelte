<script lang="ts">
  import { onMount } from 'svelte';
  import { goto, afterNavigate } from '$app/navigation';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import Nav from '$lib/components/Nav.svelte';
  
  let sessionId = $state('');
  
  let tabs = $state<Array<{id: string, name: string}>>([
    { id: 'tab1', name: 'Terminal 1' }
  ]);
  let activeTabId = $state('tab1');
  let terminalStatus = $state<Record<string, string>>({
    tab1: 'ready'
  });
  let ws = $state<WebSocket | null>(null);
  let iframeRefs = $state<Record<string, HTMLIFrameElement | null>>({});
  
  onMount(() => {
    sessionId = get(page).params.id || '';
    
    if (!sessionId) {
      goto('/dashboard');
      return;
    }
    
    initSession();
    
    afterNavigate(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
    
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  });
  
  async function initSession() {
    connectWebSocket();
    await startTerminal(activeTabId);
  }
  
  function connectWebSocket() {
    console.log(`Connecting to WebSocket for session ${sessionId}`);
    setTimeout(() => {
      console.log('WebSocket connected');
    }, 1000);
  }
  
  function startTerminal(tabId: string) {
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
    if (tabs.length <= 1) return;
    
    tabs = tabs.filter(tab => tab.id !== tabId);
    
    if (activeTabId === tabId) {
      activeTabId = tabs[0]?.id || '';
    }
  }
  
  async function switchTab(tabId: string) {
    activeTabId = tabId;
    
    if (!terminalStatus[tabId] || terminalStatus[tabId] === 'error') {
      await startTerminal(tabId);
    }
  }
  
  function getTerminalUrl(tabId: string): string {
    return `/terminal/${sessionId}/tab?tab=${tabId}`;
  }
  
</script>

<svelte:head>
  <title>Session {sessionId} - myfilepath.com</title>
</svelte:head>

<div class="h-screen flex flex-col bg-neutral-950 text-neutral-300">
  <!-- Header -->
  <Nav variant="session" sessionId={sessionId} email={($page).data?.user?.email || ''} />
  
  <!-- Tabs -->
  <div class="flex items-center gap-0 px-4 border-b border-neutral-800 bg-neutral-900/50">
    {#each tabs as tab (tab.id)}
      <button
        onclick={() => switchTab(tab.id)}
        class="flex items-center gap-2 px-4 py-2 text-sm transition-colors cursor-pointer
          {activeTabId === tab.id ? 'text-neutral-100 border-b border-neutral-100 -mb-px' : 'text-neutral-500 hover:text-neutral-300'}"
      >
        <span>{tab.name}</span>
        {#if terminalStatus[tab.id] === 'starting'}
          <span class="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin"></span>
        {:else if terminalStatus[tab.id] === 'ready'}
          <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
        {:else if terminalStatus[tab.id] === 'error'}
          <span class="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
        {:else}
          <span class="w-1.5 h-1.5 bg-neutral-600 rounded-full"></span>
        {/if}
        {#if tabs.length > 1}
          <span
            role="button"
            tabindex="0"
            onclick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
            onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); closeTab(tab.id); } }}
            class="ml-1 text-neutral-600 hover:text-neutral-300 cursor-pointer"
          >
            ×
          </span>
        {/if}
      </button>
    {/each}
    <button
      onclick={addTab}
      class="px-3 py-2 text-neutral-600 hover:text-neutral-300 transition-colors cursor-pointer text-sm"
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
              <div class="w-8 h-8 border-2 border-neutral-700 border-t-neutral-400 rounded-full animate-spin mb-4 mx-auto"></div>
              <p class="text-neutral-300 text-sm">Starting terminal…</p>
              <p class="text-neutral-600 font-mono text-xs mt-2">This may take a moment</p>
            </div>
          </div>
        {:else if terminalStatus[tab.id] === 'error'}
          <div class="flex items-center justify-center h-full">
            <div class="text-center">
              <p class="text-red-400 text-sm mb-4">Terminal failed to start</p>
              <button
                onclick={() => startTerminal(tab.id)}
                class="px-4 py-2 text-sm bg-neutral-900 border border-neutral-700 rounded text-neutral-300 hover:border-neutral-500 transition-colors cursor-pointer"
              >
                retry
              </button>
            </div>
          </div>
        {:else}
          <div class="flex items-center justify-center h-full">
            <p class="text-neutral-600 font-mono text-sm">Initializing…</p>
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
</style>
