<script lang="ts">
  import { getAgent } from '$lib/agents/catalog';
  import { statusColors } from './status-colors';
  import ChatPanel from './ChatPanel.svelte';
  import type { AgentSlot } from '$lib/types/session';
  import type { AgentChatClient } from '$lib/agents/chat-client';

  interface Props {
    workers: AgentSlot[];
    activeWorkerId: string | null;
    chatClients: Record<string, AgentChatClient>;
    onSelectWorker: (workerId: string) => void;
    getTerminalUrl: (slot: AgentSlot) => string;
  }

  let { workers, activeWorkerId, chatClients, onSelectWorker, getTerminalUrl }: Props = $props();

  // Per-worker view mode: 'terminal' | 'chat' | 'split'
  let workerViewMode = $state<Record<string, 'terminal' | 'chat' | 'split'>>({});

  function getViewMode(workerId: string): 'terminal' | 'chat' | 'split' {
    return workerViewMode[workerId] ?? 'chat';
  }

  function setViewMode(workerId: string, mode: 'terminal' | 'chat' | 'split') {
    workerViewMode = { ...workerViewMode, [workerId]: mode };
  }

  function handleWorkerSendMessage(workerId: string, content: string) {
    const client = chatClients[workerId];
    if (client) client.sendMessage(content);
  }

  function handleWorkerCancel(workerId: string) {
    const client = chatClients[workerId];
    if (client) client.cancel();
  }
</script>

<div class="flex h-full w-full flex-col bg-neutral-950">
  {#if workers.length === 0}
    <!-- Empty state -->
    <div class="flex flex-1 items-center justify-center">
      <p class="text-sm text-neutral-500">No workers in this session</p>
    </div>
  {:else}
    <!-- Tab bar -->
    <div class="flex shrink-0 gap-0 overflow-x-auto border-b border-neutral-800 bg-neutral-900/50">
      {#each workers as worker (worker.id)}
        {@const catalog = getAgent(worker.agentType)}
        <button
          onclick={() => onSelectWorker(worker.id)}
          class="relative flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm transition-colors
            {activeWorkerId === worker.id
              ? 'text-neutral-100'
              : 'text-neutral-400 hover:bg-neutral-800/40 hover:text-neutral-200'}"
        >
          <span class="text-base">{catalog.icon}</span>
          <span class="whitespace-nowrap font-medium">{worker.name}</span>
          <span class="size-1.5 shrink-0 rounded-full {statusColors[worker.status]}"></span>

          <!-- Active indicator -->
          {#if activeWorkerId === worker.id}
            <span class="absolute bottom-0 left-0 h-0.5 w-full bg-emerald-500"></span>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Content area: all workers rendered, hidden via CSS to preserve iframe state -->
    <div class="relative flex-1">
      {#each workers as worker (worker.id)}
        {@const client = chatClients[worker.id]}
        {@const catalog = getAgent(worker.agentType)}
        {@const viewMode = getViewMode(worker.id)}
        {@const terminalUrl = getTerminalUrl(worker)}
        <div class="absolute inset-0 flex flex-col" class:hidden={activeWorkerId !== worker.id}>
          <!-- View mode toggle -->
          {#if worker.status === 'running' || worker.status === 'starting' || worker.status === 'pending'}
            <div class="flex shrink-0 items-center gap-1 border-b border-neutral-800/50 bg-neutral-900/30 px-3 py-1.5">
              <button
                onclick={() => setViewMode(worker.id, 'chat')}
                class="rounded px-2.5 py-1 text-xs font-medium transition-colors
                  {viewMode === 'chat' ? 'bg-neutral-700 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'}"
              >
                💬 Chat
              </button>
              <button
                onclick={() => setViewMode(worker.id, 'terminal')}
                class="rounded px-2.5 py-1 text-xs font-medium transition-colors
                  {viewMode === 'terminal' ? 'bg-neutral-700 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'}"
              >
                🖥️ Terminal
              </button>
              <button
                onclick={() => setViewMode(worker.id, 'split')}
                class="rounded px-2.5 py-1 text-xs font-medium transition-colors
                  {viewMode === 'split' ? 'bg-neutral-700 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'}"
              >
                ⬜ Split
              </button>
            </div>
          {/if}

          <!-- Content based on view mode -->
          <div class="flex flex-1 overflow-hidden">
            {#if worker.status === 'running' || client}
              <!-- Chat view -->
              {#if viewMode === 'chat' || viewMode === 'split'}
                <div class="{viewMode === 'split' ? 'w-1/2 border-r border-neutral-800' : 'w-full'}">
                  {#if client}
                    <ChatPanel
                      agentName={worker.name}
                      agentIcon={catalog.icon}
                      messages={client.messages}
                      collapsed={false}
                      isConnected={client.isConnected}
                      status={client.status}
                      onSendMessage={(content) => handleWorkerSendMessage(worker.id, content)}
                      onToggleCollapse={() => {}}
                      onCancel={() => handleWorkerCancel(worker.id)}
                    />
                  {:else}
                    <div class="flex h-full items-center justify-center">
                      <p class="text-sm text-neutral-500">Chat not available</p>
                    </div>
                  {/if}
                </div>
              {/if}

              <!-- Terminal view -->
              {#if viewMode === 'terminal' || viewMode === 'split'}
                <div class="{viewMode === 'split' ? 'w-1/2' : 'w-full'}">
                  {#if worker.containerId && terminalUrl}
                    <iframe
                      src={terminalUrl}
                      class="h-full w-full border-0"
                      title="{worker.name} terminal"
                    ></iframe>
                  {:else}
                    <div class="flex h-full items-center justify-center bg-black">
                      <p class="text-sm text-neutral-500">No container assigned</p>
                    </div>
                  {/if}
                </div>
              {/if}
            {:else if worker.status === 'starting'}
              <div class="flex w-full flex-col items-center justify-center gap-3">
                <div class="size-6 animate-spin rounded-full border-2 border-neutral-600 border-t-emerald-500"></div>
                <p class="text-sm text-neutral-400">Starting worker...</p>
              </div>
            {:else if worker.status === 'pending'}
              <div class="flex w-full items-center justify-center">
                <p class="text-sm text-neutral-500">Waiting to start...</p>
              </div>
            {:else if worker.status === 'error'}
              <div class="flex w-full flex-col items-center justify-center gap-2">
                <span class="text-2xl">⚠️</span>
                <p class="text-sm text-red-400">Worker encountered an error</p>
                <p class="text-xs text-neutral-500">Try stopping and restarting the session</p>
              </div>
            {:else if worker.status === 'stopped'}
              <div class="flex w-full items-center justify-center">
                <p class="text-sm text-neutral-500">Worker stopped</p>
              </div>
            {/if}
          </div>
        </div>
      {/each}

      {#if !activeWorkerId}
        <div class="flex h-full items-center justify-center">
          <p class="text-sm text-neutral-500">Select a worker tab</p>
        </div>
      {/if}
    </div>
  {/if}
</div>
