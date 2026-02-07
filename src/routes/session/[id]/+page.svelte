<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import Nav from '$lib/components/Nav.svelte';
  import SessionSidebar from '$lib/components/session/SessionSidebar.svelte';
  import ChatPanel from '$lib/components/session/ChatPanel.svelte';
  import WorkerTabs from '$lib/components/session/WorkerTabs.svelte';
  import { PaneGroup, Pane, Handle } from '$lib/components/ui/resizable';
  import type { MultiAgentSession, AgentSlot } from '$lib/types/session';
  import { createAgentChatClient, type AgentChatClient } from '$lib/agents/chat-client.svelte';

  // Session data
  let sessionId = $derived(page.params.id ?? '');
  let session = $state<MultiAgentSession | null>(null);
  let slots = $state<AgentSlot[]>([]);
  let isMultiAgent = $state(false);
  let isLoading = $state(true);
  let errorMessage = $state<string | null>(null);

  // Panel state
  let sidebarCollapsed = $state(false);
  let chatCollapsed = $state(false);
  let selectedSlotId = $state<string | null>(null);
  let activeWorkerId = $state<string | null>(null);

  // Chat clients — one per slot (orchestrator + workers)
  let chatClients = $state<Record<string, AgentChatClient>>({});
  let orchestratorChatClient = $derived(orchestratorSlot ? chatClients[orchestratorSlot.id] ?? null : null);

  // Legacy terminal state (for non-multi-agent sessions)
  let tabs = $state<Array<{id: string, name: string}>>([{ id: 'tab1', name: 'Terminal 1' }]);
  let activeTabId = $state('tab1');
  let terminalStatus = $state<Record<string, string>>({ tab1: 'ready' });

  // Derived
  let orchestratorSlot = $derived(slots.find(s => s.role === 'orchestrator'));
  let workerSlots = $derived(slots.filter(s => s.role === 'worker'));

  onMount(() => {
    if (!sessionId) {
      goto('/dashboard');
      return;
    }
    loadSession();

    // Cleanup on unmount: disconnect all chat clients
    return () => {
      for (const client of Object.values(chatClients)) {
        client.disconnect();
      }
    };
  });

  async function loadSession() {
    errorMessage = null;
    try {
      // Try multi-agent endpoint first
      const multiRes = await fetch(`/api/session/multi?id=${sessionId}`);
      if (multiRes.ok) {
        const data = await multiRes.json() as { session?: MultiAgentSession; slots?: AgentSlot[] };
        if (data.session && data.slots && data.slots.length > 0) {
          session = data.session;
          slots = data.slots;
          isMultiAgent = true;
          // Select first worker if any
          const firstWorker = workerSlots[0];
          if (firstWorker) {
            activeWorkerId = firstWorker.id;
          }
          // Initialize chat clients for all slots
          await initChatClients();
          isLoading = false;
          return;
        }
      }
    } catch {
      // Multi endpoint failed, try legacy
    }

    try {
      // Fall back to legacy single-session endpoint
      const legacyRes = await fetch(`/api/session/${sessionId}`);
      if (legacyRes.ok) {
        // Legacy mode — no multi-agent data, just show terminal
      } else {
        errorMessage = `Failed to load session (${legacyRes.status})`;
      }
    } catch {
      errorMessage = 'Failed to connect to the server. Please check your connection.';
    }
    isLoading = false;
  }

  // Worker URL for WebSocket connections, loaded from server config
  let workerUrl = $state('');

  /**
   * Fetch the worker URL from the server config endpoint.
   * Falls back to same-origin if the fetch fails.
   */
  async function loadWorkerUrl(): Promise<string> {
    if (workerUrl) return workerUrl;
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const config = await res.json() as { workerUrl: string };
        workerUrl = config.workerUrl;
        return workerUrl;
      }
    } catch {
      // Ignore — fall back to hardcoded
    }
    // Fallback
    if (typeof window !== 'undefined' && window.location.hostname === 'myfilepath.com') {
      workerUrl = 'https://api.myfilepath.com';
    } else {
      workerUrl = typeof window !== 'undefined' ? window.location.origin : '';
    }
    return workerUrl;
  }

  /**
   * Initialize chat clients for ALL slots (orchestrator + workers).
   * Each slot gets its own ChatAgent DO instance.
   */
  async function initChatClients() {
    // Disconnect all existing clients
    for (const client of Object.values(chatClients)) {
      client.disconnect();
    }
    chatClients = {};

    const url = await loadWorkerUrl();

    for (const slot of slots) {
      chatClients[slot.id] = createAgentChatClient({
        workerUrl: url,
        agentName: `chat-${slot.id}`,
        initialState: {
          slotId: slot.id,
          sessionId,
          agentType: slot.agentType,
          model: slot.config.model,
          systemPrompt: slot.config.systemPrompt || '',
          containerId: slot.containerId || undefined,
        },
      });
    }
  }

  function handleSendMessage(content: string) {
    if (!orchestratorChatClient) return;
    orchestratorChatClient.sendMessage(content);
  }

  function handleCancel() {
    if (!orchestratorChatClient) return;
    orchestratorChatClient.cancel();
  }

  function handleSelectSlot(slotId: string) {
    selectedSlotId = slotId;
    const slot = slots.find(s => s.id === slotId);
    if (slot && slot.role === 'worker') {
      activeWorkerId = slotId;
    }
  }

  let isStarting = $state(false);

  async function handleStartSession() {
    isStarting = true;
    errorMessage = null;
    try {
      const res = await fetch('/api/session/multi/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: `Start failed: ${res.status}` }));
        throw new Error((data as { message?: string }).message || `Start failed: ${res.status}`);
      }

      // Reload session data to get updated statuses
      await loadSession();

      // If the session is still starting, poll until it becomes running or error
      if (session?.status === 'starting') {
        const pollIntervalMs = 2000;
        const maxWaitMs = 30000;
        let elapsed = 0;

        while (elapsed < maxWaitMs && session?.status === 'starting') {
          await new Promise<void>((resolve) => setTimeout(resolve, pollIntervalMs));
          elapsed += pollIntervalMs;
          await loadSession();
        }

        if (session?.status === 'starting') {
          throw new Error('Session took too long to start. Please try again.');
        }
        if (session?.status === 'error') {
          throw new Error('Session failed to start.');
        }
      }

      // Wait for the orchestrator WebSocket to be connected before sending
      if (session && orchestratorChatClient) {
        const connected = await orchestratorChatClient.waitForConnection(5000);
        if (connected) {
          const parts: string[] = [];
          if (session.name) parts.push(`**Task:** ${session.name}`);
          if (session.description) parts.push(session.description);
          if (session.gitRepoUrl) parts.push(`**Git repo:** ${session.gitRepoUrl}`);
          if (workerSlots.length > 0) {
            const workerNames = workerSlots.map(w => w.name).join(', ');
            parts.push(`**Workers available:** ${workerNames}`);
          }
          if (parts.length > 0) {
            orchestratorChatClient.sendMessage(parts.join('\n\n'));
          }
        } else {
          console.warn('[session] orchestrator WebSocket did not connect in time');
        }
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Failed to start session';
    }
    isStarting = false;
  }

  async function handleStopSession() {
    errorMessage = null;
    try {
      const res = await fetch('/api/session/multi/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) throw new Error(`Stop request failed: ${res.status}`);
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Failed to stop session';
    }
    if (session) {
      session = { ...session, status: 'stopped' };
    }
    slots = slots.map(s => ({ ...s, status: 'stopped' as const }));
    for (const client of Object.values(chatClients)) {
      client.disconnect();
    }
    chatClients = {};
  }

  function dismissError() {
    errorMessage = null;
  }

  function getTerminalUrl(slot: AgentSlot): string {
    if (slot.containerId && workerUrl) {
      // Load terminal page directly from worker domain.
      // The worker serves /agent-terminal/{containerId} which renders xterm.js.
      // WebSocket connections also go directly to worker (SvelteKit can't proxy WS).
      return `${workerUrl}/agent-terminal/${slot.containerId}`;
    }
    return '';
  }

  // Legacy terminal functions
  function startTerminal(tabId: string) {
    terminalStatus[tabId] = 'ready';
  }

  function getLegacyTerminalUrl(tabId: string): string {
    return `/terminal/${sessionId}/tab?tab=${tabId}`;
  }

  function addTab() {
    const newTabId = `tab${tabs.length + 1}`;
    tabs = [...tabs, { id: newTabId, name: `Terminal ${tabs.length + 1}` }];
    activeTabId = newTabId;
    startTerminal(newTabId);
  }

  function closeTab(tabId: string) {
    if (tabs.length <= 1) return;
    tabs = tabs.filter(t => t.id !== tabId);
    if (activeTabId === tabId) {
      activeTabId = tabs[0]?.id || '';
    }
  }
</script>

<svelte:head>
  <title>Session {session?.name || sessionId} - myfilepath.com</title>
</svelte:head>

{#if isLoading}
  <div class="h-screen flex items-center justify-center bg-neutral-950">
    <div class="text-center">
      <div class="w-8 h-8 border-2 border-neutral-700 border-t-neutral-400 rounded-full animate-spin mb-4 mx-auto"></div>
      <p class="text-neutral-400 text-sm">Loading session…</p>
    </div>
  </div>
{:else if isMultiAgent && session}
  <!-- Multi-Agent 3-Panel Resizable Layout -->
  <div class="h-screen flex flex-col bg-neutral-950">
    <Nav variant="session" sessionId={sessionId} />

    <!-- Error banner -->
    {#if errorMessage}
      <div class="flex items-center gap-2 border-b border-red-900/50 bg-red-950/50 px-4 py-2 text-sm text-red-300">
        <span class="shrink-0">⚠️</span>
        <span class="flex-1">{errorMessage}</span>
        <button
          onclick={dismissError}
          class="shrink-0 rounded px-2 py-0.5 text-xs text-red-400 hover:bg-red-900/30 hover:text-red-200"
        >
          Dismiss
        </button>
      </div>
    {/if}

    <div class="flex-1 overflow-hidden">
      <PaneGroup direction="horizontal" autoSaveId="session-panels">
        <!-- Left: Sidebar Pane -->
        <Pane defaultSize={20} minSize={10}>
          <SessionSidebar
            {session}
            {slots}
            collapsed={sidebarCollapsed}
            {selectedSlotId}
            onToggleCollapse={() => sidebarCollapsed = !sidebarCollapsed}
            onSelectSlot={handleSelectSlot}
            onStartSession={handleStartSession}
            onStopSession={handleStopSession}
            {isStarting}
          />
        </Pane>

        <Handle withHandle />

        <!-- Center: Chat Pane -->
        {#if orchestratorSlot}
          <Pane defaultSize={35} minSize={15}>
            <ChatPanel
              agentName={orchestratorSlot.name}
              agentIcon="🤖"
              label="Orchestrator"
              messages={orchestratorChatClient?.messages ?? []}
              collapsed={chatCollapsed}
              isConnected={orchestratorChatClient?.isConnected ?? false}
              status={orchestratorChatClient?.status ?? 'ready'}
              onSendMessage={handleSendMessage}
              onToggleCollapse={() => chatCollapsed = !chatCollapsed}
              onCancel={handleCancel}
            />
          </Pane>

          <Handle withHandle />
        {/if}

        <!-- Right: Worker Tabs Pane -->
        <Pane defaultSize={45} minSize={15}>
          <WorkerTabs
            workers={workerSlots}
            {activeWorkerId}
            {chatClients}
            onSelectWorker={(id) => activeWorkerId = id}
            {getTerminalUrl}
          />
        </Pane>
      </PaneGroup>
    </div>
  </div>
{:else}
  <!-- Legacy Single-Terminal Layout -->
  <div class="h-screen flex flex-col bg-neutral-950 text-neutral-300">
    <Nav variant="session" sessionId={sessionId} />

    <!-- Error banner -->
    {#if errorMessage}
      <div class="flex items-center gap-2 border-b border-red-900/50 bg-red-950/50 px-4 py-2 text-sm text-red-300">
        <span class="shrink-0">⚠️</span>
        <span class="flex-1">{errorMessage}</span>
        <button
          onclick={dismissError}
          class="shrink-0 rounded px-2 py-0.5 text-xs text-red-400 hover:bg-red-900/30 hover:text-red-200"
        >
          Dismiss
        </button>
      </div>
    {/if}

    <!-- Tabs -->
    <div class="flex items-center gap-0 px-4 border-b border-neutral-800 bg-neutral-900/50">
      {#each tabs as tab (tab.id)}
        <button
          onclick={() => { activeTabId = tab.id; }}
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
              onclick={(e: MouseEvent) => { e.stopPropagation(); closeTab(tab.id); }}
              onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') { e.stopPropagation(); closeTab(tab.id); } }}
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
        <div class="absolute inset-0 {activeTabId === tab.id ? 'block' : 'hidden'}">
          {#if terminalStatus[tab.id] === 'ready'}
            <iframe
              src={getLegacyTerminalUrl(tab.id)}
              class="w-full h-full border-0"
              title="Terminal {tab.name}"
            ></iframe>
          {:else if terminalStatus[tab.id] === 'starting'}
            <div class="flex items-center justify-center h-full">
              <div class="text-center">
                <div class="w-8 h-8 border-2 border-neutral-700 border-t-neutral-400 rounded-full animate-spin mb-4 mx-auto"></div>
                <p class="text-neutral-300 text-sm">Starting terminal…</p>
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
{/if}

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
</style>
