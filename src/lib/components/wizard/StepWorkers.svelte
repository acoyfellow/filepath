<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Badge } from '$lib/components/ui/badge';
  import { Separator } from '$lib/components/ui/separator';
  import { getAgentsByRole, getAgent } from '$lib/agents/catalog';
  import AgentConfigEditor from './AgentConfigEditor.svelte';
  import type { AgentType, AgentConfig } from '$lib/types/session';

  interface WorkerEntry {
    id: string;
    agentType: AgentType;
    name: string;
    config: AgentConfig;
  }

  interface Props {
    workers: WorkerEntry[];
    onAdd: (agentType: AgentType) => void;
    onRemove: (id: string) => void;
    onUpdateName: (id: string, name: string) => void;
    onUpdateConfig: (id: string, config: AgentConfig) => void;
  }

  let { workers, onAdd, onRemove, onUpdateName, onUpdateConfig }: Props = $props();

  const workerAgents = getAgentsByRole('worker');

  let expandedId = $state<string | null>(null);
  let showPicker = $state(false);

  function toggleExpanded(id: string) {
    expandedId = expandedId === id ? null : id;
  }

  function handleAdd(agentType: AgentType) {
    onAdd(agentType);
    showPicker = false;
  }
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-xl font-semibold text-white mb-1">Add Workers</h2>
    <p class="text-sm text-neutral-400">
      Add worker agents to parallelize tasks. Workers are coordinated by the orchestrator.
    </p>
  </div>

  <!-- Worker List -->
  {#if workers.length === 0}
    <div class="rounded-lg border border-dashed border-neutral-700 bg-neutral-900/30 p-8 text-center">
      <p class="text-neutral-500 text-sm">No workers yet. Add workers to parallelize tasks.</p>
    </div>
  {:else}
    <div class="space-y-3">
      {#each workers as worker (worker.id)}
        {@const agent = getAgent(worker.agentType)}
        {@const isExpanded = expandedId === worker.id}
        <Card.Root class="bg-neutral-900 border-neutral-700">
          <Card.Header class="pb-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <span class="text-2xl shrink-0">{agent.icon}</span>
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <Card.Title class="text-white text-base truncate">{worker.name}</Card.Title>
                    <Badge variant="secondary" class="shrink-0 text-xs">{agent.name}</Badge>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  class="text-neutral-400 hover:text-white h-8 px-2 text-xs"
                  onclick={() => toggleExpanded(worker.id)}
                >
                  {isExpanded ? '▲ Collapse' : '▼ Configure'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  class="text-neutral-500 hover:text-red-400 h-8 w-8 p-0"
                  onclick={() => onRemove(worker.id)}
                >
                  ✕
                </Button>
              </div>
            </div>
          </Card.Header>

          {#if isExpanded}
            <Card.Content class="pt-0 space-y-4">
              <Separator class="bg-neutral-800" />

              <!-- Custom Name -->
              <div class="space-y-2">
                <Label class="text-neutral-300">Worker Name</Label>
                <Input
                  value={worker.name}
                  oninput={(e: Event) =>
                    onUpdateName(worker.id, (e.target as HTMLInputElement).value)}
                  placeholder="Worker name"
                  class="bg-neutral-900 border-neutral-700 text-white placeholder:text-neutral-500"
                />
              </div>

              <AgentConfigEditor
                config={worker.config}
                onUpdateConfig={(updatedConfig) => onUpdateConfig(worker.id, updatedConfig)}
                promptPlaceholder="Optional system prompt for this worker..."
                promptRows={3}
              />
            </Card.Content>
          {/if}
        </Card.Root>
      {/each}
    </div>
  {/if}

  <!-- Add Worker Button / Picker -->
  {#if showPicker}
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <Label class="text-neutral-300 text-sm">Select an agent type</Label>
        <Button
          variant="ghost"
          size="sm"
          class="text-neutral-500 hover:text-white h-8 px-2 text-xs"
          onclick={() => (showPicker = false)}
        >
          ✕ Cancel
        </Button>
      </div>
      <div class="flex flex-wrap gap-2">
        {#each workerAgents as agent (agent.id)}
          <button
            type="button"
            class="flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-left transition-colors hover:border-emerald-500 hover:bg-neutral-800 focus:outline-none"
            onclick={() => handleAdd(agent.id)}
          >
            <span class="text-lg">{agent.icon}</span>
            <div>
              <p class="text-sm font-medium text-white">{agent.name}</p>
              <p class="text-xs text-neutral-500 max-w-[200px] truncate">{agent.description}</p>
            </div>
          </button>
        {/each}
      </div>
    </div>
  {:else}
    <Button
      variant="outline"
      class="border-dashed border-neutral-700 text-neutral-400 hover:text-white hover:border-emerald-500 hover:bg-neutral-900 w-full"
      onclick={() => (showPicker = true)}
    >
      + Add Worker
    </Button>
  {/if}
</div>
