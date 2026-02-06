<script lang="ts">
  import { getAgent } from '$lib/agents/catalog';
  import { statusColors } from './status-colors';
  import type { AgentSlot } from '$lib/types/session';

  interface Props {
    workers: AgentSlot[];
    activeWorkerId: string | null;
    onSelectWorker: (workerId: string) => void;
    getTerminalUrl: (slot: AgentSlot) => string;
  }

  let { workers, activeWorkerId, onSelectWorker, getTerminalUrl }: Props = $props();


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
        <div class="absolute inset-0" class:hidden={activeWorkerId !== worker.id}>
          {#if worker.status === 'running' && worker.containerId}
            <iframe
              src={getTerminalUrl(worker)}
              class="h-full w-full border-0"
              title="{worker.name} terminal"
            ></iframe>
          {:else if worker.status === 'starting'}
            <div class="flex h-full flex-col items-center justify-center gap-3">
              <div class="size-6 animate-spin rounded-full border-2 border-neutral-600 border-t-emerald-500"></div>
              <p class="text-sm text-neutral-400">Starting worker...</p>
            </div>
          {:else if worker.status === 'pending'}
            <div class="flex h-full items-center justify-center">
              <p class="text-sm text-neutral-500">Waiting to start...</p>
            </div>
          {:else if worker.status === 'error'}
            <div class="flex h-full flex-col items-center justify-center gap-2">
              <span class="text-2xl">⚠️</span>
              <p class="text-sm text-red-400">Worker encountered an error</p>
              <p class="text-xs text-neutral-500">Try stopping and restarting the session</p>
            </div>
          {:else if worker.status === 'stopped'}
            <div class="flex h-full items-center justify-center">
              <p class="text-sm text-neutral-500">Worker stopped</p>
            </div>
          {/if}
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
