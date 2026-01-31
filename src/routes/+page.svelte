<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import { signIn, signOut, signUp } from '$lib/auth-client';

  let { data } = $props();

  // Auth state
  let email = $state('');
  let password = $state('');
  let isLoading = $state(false);

  // Session state
  let sessionId = $state('');
  let tabs = $state<Array<{id: string, name: string}>>([]);
  let activeTabId = $state('');
  let terminalStatus = $state<Record<string, string>>({});
  let ws: WebSocket | null = null;

  // Terminal iframe refs
  let iframeRefs = $state<Record<string, HTMLIFrameElement | null>>({});

  onMount(async () => {
    // Generate or restore session ID
    const storedSessionId = localStorage.getItem('filepath-session-id');
    sessionId = storedSessionId || crypto.randomUUID().slice(0, 8);
    if (!storedSessionId) {
      localStorage.setItem('filepath-session-id', sessionId);
    }

    // Initialize session via worker
    await initSession();
  });

  onDestroy(() => {
    if (ws) ws.close();
  });

  async function initSession() {
    try {
      // Get initial state from DO
      const res = await fetch(`/api/session/${sessionId}/state`);
      if (res.ok) {
        const state = await res.json() as { tabs?: Array<{id: string, name: string}>, activeTabId?: string };
        tabs = state.tabs || [{ id: 'tab1', name: 'Terminal 1' }];
        activeTabId = state.activeTabId || tabs[0]?.id || 'tab1';
      } else {
        // Initialize with default tab
        tabs = [{ id: 'tab1', name: 'Terminal 1' }];
        activeTabId = 'tab1';
      }

      // Connect WebSocket for real-time updates
      connectWebSocket();

      // Start first terminal
      await startTerminal(activeTabId);
    } catch (err) {
      console.error('Failed to init session:', err);
      tabs = [{ id: 'tab1', name: 'Terminal 1' }];
      activeTabId = 'tab1';
    }
  }

  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/session/${sessionId}/ws`;
    
    ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'tabs') {
          tabs = msg.tabs;
          activeTabId = msg.activeTabId;
        }
      } catch {}
    };
    ws.onclose = () => {
      // Reconnect after delay
      setTimeout(connectWebSocket, 2000);
    };
  }

  function startTerminal(tabId: string) {
    // Terminal start is handled by the terminal HTML page itself
    // Just mark as ready so the iframe is shown
    terminalStatus[tabId] = 'ready';
  }

  async function addTab() {
    const res = await fetch(`/api/session/${sessionId}/tab`, {
      method: 'POST'
    });
    if (res.ok) {
      const result = await res.json() as { tab: {id: string, name: string}, state: { tabs: Array<{id: string, name: string}>, activeTabId: string } };
      tabs = result.state.tabs;
      activeTabId = result.state.activeTabId;
      await startTerminal(result.tab.id);
    }
  }

  async function closeTab(tabId: string) {
    if (tabs.length <= 1) return; // Keep at least one tab
    
    const res = await fetch(`/api/session/${sessionId}/tab/${tabId}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      const result = await res.json() as { state: { tabs: Array<{id: string, name: string}>, activeTabId: string } };
      tabs = result.state.tabs;
      activeTabId = result.state.activeTabId;
    }
  }

  async function switchTab(tabId: string) {
    const res = await fetch(`/api/session/${sessionId}/active/${tabId}`, {
      method: 'POST'
    });
    if (res.ok) {
      activeTabId = tabId;
      // Start terminal if not already running
      if (!terminalStatus[tabId] || terminalStatus[tabId] === 'error') {
        await startTerminal(tabId);
      }
    }
  }

  function getTerminalUrl(tabId: string): string {
    // Point to terminal HTML page served by worker
    // Format: /terminal/{sessionId}/tab?tab={tabId}
    return `/terminal/${sessionId}/tab?tab=${tabId}`;
  }

  // Auth handlers
  async function handleSignIn() {
    if (!email.trim() || !password.trim()) return;
    isLoading = true;
    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        alert(result.error.message);
        return;
      }
      email = '';
      password = '';
      await invalidateAll();
    } catch (error) {
      alert('Sign in failed: ' + (error as Error).message);
    } finally {
      isLoading = false;
    }
  }

  async function handleSignUp() {
    if (!email.trim() || !password.trim()) return;
    if (password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    isLoading = true;
    try {
      const result = await signUp.email({
        email,
        password,
        name: email.split('@')[0]
      });
      if (result.error) {
        alert(result.error.message);
        return;
      }
      email = '';
      password = '';
      await invalidateAll();
    } catch (error) {
      alert('Sign up failed: ' + (error as Error).message);
    } finally {
      isLoading = false;
    }
  }
</script>

<svelte:head>
  <title>myfilepath.com</title>
</svelte:head>

<div class="h-screen flex flex-col bg-white">
  <!-- Header -->
  <header class="flex items-center justify-between p-4 border-b-4 border-black">
    <div class="flex items-center gap-4">
      <a href="/" class="px-4 py-2 text-xl font-black bg-black text-white border-4 border-black hover:bg-white hover:text-black">
        myfilepath.com
      </a>
      <span class="px-3 py-1 font-mono text-sm border-4 border-black bg-white">
        {sessionId}
      </span>
    </div>
    
    <div class="flex items-center gap-2">
      {#if page.data.user}
        <span class="px-3 py-2 font-mono text-sm border-4 border-black">{page.data.user.email}</span>
        <button
          onclick={async () => { await signOut(); await invalidateAll(); }}
          class="px-4 py-2 font-black border-4 border-black hover:bg-black hover:text-white"
        >
          SIGN OUT
        </button>
      {:else}
        <input
          type="email"
          placeholder="EMAIL"
          bind:value={email}
          class="px-3 py-2 font-mono text-sm border-4 border-black w-48 focus:outline-none focus:ring-0"
        />
        <input
          type="password"
          placeholder="PASSWORD"
          bind:value={password}
          class="px-3 py-2 font-mono text-sm border-4 border-black w-36 focus:outline-none focus:ring-0"
        />
        <button
          onclick={handleSignIn}
          disabled={isLoading}
          class="px-4 py-2 font-black border-4 border-black hover:bg-black hover:text-white disabled:opacity-50"
        >
          SIGN IN
        </button>
        <button
          onclick={handleSignUp}
          disabled={isLoading}
          class="px-4 py-2 font-black border-4 border-black bg-black text-white hover:bg-white hover:text-black disabled:opacity-50"
        >
          SIGN UP
        </button>
      {/if}
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
