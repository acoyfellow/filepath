<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { Separator } from '$lib/components/ui/separator';
  import { getAgent } from '$lib/agents/catalog';
  import { statusColors } from './status-colors';
  import type { AgentSlot, MultiAgentSession } from '$lib/types/session';

  interface Props {
    session: MultiAgentSession;
    slots: AgentSlot[];
    collapsed: boolean;
    selectedSlotId: string | null;
    onToggleCollapse: () => void;
    onSelectSlot: (slotId: string) => void;
    onStopSession: () => void;
  }

  let {
    session,
    slots,
    collapsed,
    selectedSlotId,
    onToggleCollapse,
    onSelectSlot,
    onStopSession,
  }: Props = $props();

  const sessionStatusVariant: Record<MultiAgentSession['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
    draft: 'outline',
    starting: 'secondary',
    running: 'default',
    paused: 'secondary',
    stopped: 'outline',
    error: 'destructive',
  };

  let orchestratorSlot = $derived(slots.find((s) => s.role === 'orchestrator'));
  let workerSlots = $derived(slots.filter((s) => s.role === 'worker'));

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
</script>

<aside
  class="flex h-full w-full flex-col bg-neutral-900"
>
  <!-- Session header -->
  <div class="flex items-center gap-2 border-b border-neutral-800 p-3 {collapsed ? 'justify-center' : 'justify-between'}">
    {#if !collapsed}
      <div class="min-w-0 flex-1">
        <h2 class="truncate text-sm font-semibold text-neutral-100">{session.name}</h2>
        <Badge variant={sessionStatusVariant[session.status]} class="mt-1 text-[10px] capitalize">
          {session.status}
        </Badge>
      </div>
    {/if}
    <button
      onclick={onToggleCollapse}
      class="flex size-7 shrink-0 items-center justify-center rounded text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      <span class="text-xs">{collapsed ? '»' : '«'}</span>
    </button>
  </div>

  {#if !collapsed}
    <!-- Session details -->
    <div class="space-y-1.5 border-b border-neutral-800 px-3 py-2">
      {#if session.description}
        <p class="text-xs leading-relaxed text-neutral-400">{session.description}</p>
      {/if}
      {#if session.gitRepoUrl}
        <a
          href={session.gitRepoUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:underline"
        >
          <span>📂</span>
          <span class="truncate">{session.gitRepoUrl.replace(/^https?:\/\//, '')}</span>
        </a>
      {/if}
      <p class="text-[10px] text-neutral-500">Created {formatDate(session.createdAt)}</p>
    </div>
  {/if}

  <!-- Scrollable slots area -->
  <div class="flex-1 overflow-y-auto">
    <!-- Orchestrator section -->
    {#if orchestratorSlot}
      {@const catalogEntry = getAgent(orchestratorSlot.agentType)}
      {#if !collapsed}
        <div class="px-3 pt-3 pb-1">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Orchestrator
          </span>
        </div>
      {/if}
      <button
        onclick={() => onSelectSlot(orchestratorSlot!.id)}
        class="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-neutral-800/60
          {selectedSlotId === orchestratorSlot.id ? 'bg-neutral-800' : ''}
          {collapsed ? 'justify-center' : ''}"
      >
        <span class="shrink-0 text-base" title={catalogEntry.name}>{catalogEntry.icon}</span>
        {#if !collapsed}
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="truncate text-xs font-medium text-neutral-200">{orchestratorSlot.name}</span>
              <span class="size-1.5 shrink-0 rounded-full {statusColors[orchestratorSlot.status]}"></span>
            </div>
            <p class="truncate text-[10px] text-neutral-500">{orchestratorSlot.config.model}</p>
          </div>
        {:else}
          <span class="size-1.5 shrink-0 rounded-full {statusColors[orchestratorSlot.status]}"></span>
        {/if}
      </button>
    {/if}

    <Separator class="bg-neutral-800" />

    <!-- Workers section -->
    {#if !collapsed}
      <div class="px-3 pt-3 pb-1">
        <span class="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          Workers ({workerSlots.length})
        </span>
      </div>
    {/if}

    {#each workerSlots as slot (slot.id)}
      {@const catalogEntry = getAgent(slot.agentType)}
      <button
        onclick={() => onSelectSlot(slot.id)}
        class="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-neutral-800/60
          {selectedSlotId === slot.id ? 'bg-neutral-800' : ''}
          {collapsed ? 'justify-center' : ''}"
      >
        <span class="shrink-0 text-base" title={catalogEntry.name}>{catalogEntry.icon}</span>
        {#if !collapsed}
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="truncate text-xs font-medium text-neutral-200">{slot.name}</span>
              <span class="size-1.5 shrink-0 rounded-full {statusColors[slot.status]}"></span>
            </div>
            <p class="truncate text-[10px] text-neutral-500">{slot.config.model}</p>
          </div>
        {:else}
          <span class="size-1.5 shrink-0 rounded-full {statusColors[slot.status]}"></span>
        {/if}
      </button>
    {/each}

    {#if workerSlots.length === 0 && !collapsed}
      <p class="px-3 py-4 text-center text-xs text-neutral-600">No workers configured</p>
    {/if}
  </div>

  <!-- Footer -->
  <div class="border-t border-neutral-800 p-2 {collapsed ? 'flex flex-col items-center gap-1' : 'space-y-1.5'}">
    {#if collapsed}
      <Button
        variant="ghost"
        size="icon-sm"
        class="text-red-400 hover:bg-red-950 hover:text-red-300"
        onclick={onStopSession}
        disabled={session.status === 'stopped' || session.status === 'draft'}
        aria-label="Stop session"
      >
        <span class="text-sm">⏹</span>
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        href="/dashboard"
        class="text-neutral-400 hover:text-neutral-200"
        aria-label="Dashboard"
      >
        <span class="text-sm">←</span>
      </Button>
    {:else}
      <Button
        variant="destructive"
        size="sm"
        class="w-full"
        onclick={onStopSession}
        disabled={session.status === 'stopped' || session.status === 'draft'}
      >
        ⏹ Stop Session
      </Button>
      <Button
        variant="ghost"
        size="sm"
        href="/dashboard"
        class="w-full text-neutral-400 hover:text-neutral-200"
      >
        ← Back to Dashboard
      </Button>
    {/if}
  </div>
</aside>
