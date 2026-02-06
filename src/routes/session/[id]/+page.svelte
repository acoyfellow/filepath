<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import Nav from '$lib/components/Nav.svelte';
  import SessionSidebar from '$lib/components/session/SessionSidebar.svelte';
  import ChatPanel from '$lib/components/session/ChatPanel.svelte';
  import WorkerTabs from '$lib/components/session/WorkerTabs.svelte';
  import type { MultiAgentSession, AgentSlot } from '$lib/types/session';

  // Session data
  let sessionId = $state('');
  let session = $state<MultiAgentSession | null>(null);
  let slots = $state<AgentSlot[]>([]);
  let isMultiAgent = $state(false);
  let isLoading = $state(true);

  // Panel state
  let sidebarCollapsed = $state(false);
  let chatCollapsed = $state(false);
  let selectedSlotId = $state<string | null>(null);
  let activeWorkerId = $state<string | null>(null);

  // Chat state
  interface ChatMessage {
    id: string;
    role: 'user' | 'agent';
    content: string;
    timestamp: number;
    status?: 'sending' | 'complete' | 'error';
  }
  let chatMessages = $state<ChatMessage[]>([]);
  let isConnected = $state(false);

  // Legacy terminal state (for non-multi-agent sessions)
  let tabs = $state<Array<{id: string, name: string}>>([{ id: 'tab1', name: 'Terminal 1' }]);
  let activeTabId = $state('tab1');
  let terminalStatus = $state<Record<string, string>>({ tab1: 'ready' });

  // Derived
  let orchestratorSlot = $derived(slots.find(s => s.role === 'orchestrator'));
  let workerSlots = $derived(slots.filter(s => s.role === 'worker'));

  onMount(() => {
    sessionId = get(page).params.id || '';
    if (!sessionId) {
      goto('/dashboard');
      return;
    }
    loadSession();
  });

  async function loadSession() {
    try {
      // Try multi-agent endpoint first
      const multiRes = await fetch(`/api/session/multi?id=${sessionId}`);
      if (multiRes.ok) {
        const data = await multiRes.json() as { session?: MultiAgentSession; slots?: AgentSlot[] };
        if (data.session && data.slots && data.slots.length > 0) {
          session = data.session;
          slots = data.slots;
          isMultiAgent = true;
          isConnected = true;
          // Select first worker if any
          const firstWorker = workerSlots[0];
          if (firstWorker) {
            activeWorkerId = firstWorker.id;
          }
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
      }
    } catch {
      // Legacy fetch also failed
    }
    isLoading = false;
  }

  async function handleSendMessage(content: string) {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'sending',
    };
    chatMessages = [...chatMessages, msg];

    try {
      const res = await fetch('/api/session/multi/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          slotId: orchestratorSlot?.id ?? selectedSlotId,
          message: content,
        }),
      });
      if (!res.ok) throw new Error(`Chat request failed: ${res.status}`);
      chatMessages = chatMessages.map(m =>
        m.id === msg.id ? { ...m, status: 'complete' as const } : m
      );
    } catch {
      chatMessages = chatMessages.map(m =>
        m.id === msg.id ? { ...m, status: 'error' as const } : m
      );
    }
  }

  function handleSelectSlot(slotId: string) {
    selectedSlotId = slotId;
    const slot = slots.find(s => s.id === slotId);
    if (slot && slot.role === 'worker') {
      activeWorkerId = slotId;
    }
  }

  async function handleStopSession() {
    try {
      const res = await fetch('/api/session/multi/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) throw new Error(`Stop request failed: ${res.status}`);
    } catch {
      // Still update local state so the UI reflects the intent
    }
    if (session) {
      session = { ...session, status: 'stopped' };
    }
    slots = slots.map(s => ({ ...s, status: 'stopped' as const }));
    isConnected = false;
  }

  function getTerminalUrl(slot: AgentSlot): string {
    if (slot.containerId) {
      return `/terminal/${slot.containerId}/tab?tab=main`;
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

  async function addTab() {
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
  <!-- Multi-Agent 3-Panel Layout -->
  <div class="h-screen flex flex-col bg-neutral-950">
    <Nav variant="session" sessionId={sessionId} />
    <div class="flex-1 flex overflow-hidden">
      <!-- Left: Sidebar -->
      <SessionSidebar
        {session}
        {slots}
        collapsed={sidebarCollapsed}
        {selectedSlotId}
        onToggleCollapse={() => sidebarCollapsed = !sidebarCollapsed}
        onSelectSlot={handleSelectSlot}
        onStopSession={handleStopSession}
      />

      <!-- Center: Chat Panel -->
      {#if orchestratorSlot}
        <ChatPanel
          agentName={orchestratorSlot.name}
          agentIcon="🤖"
          messages={chatMessages}
          collapsed={chatCollapsed}
          {isConnected}
          onSendMessage={handleSendMessage}
          onToggleCollapse={() => chatCollapsed = !chatCollapsed}
        />
      {/if}

      <!-- Right: Worker Tabs -->
      <div class="flex-1 min-w-0">
        <WorkerTabs
          workers={workerSlots}
          {activeWorkerId}
          onSelectWorker={(id) => activeWorkerId = id}
          {getTerminalUrl}
        />
      </div>
    </div>
  </div>
{:else}
  <!-- Legacy Single-Terminal Layout -->
  <div class="h-screen flex flex-col bg-neutral-950 text-neutral-300">
    <Nav variant="session" sessionId={sessionId} email={get(page).data?.user?.email || ''} />

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
