<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import * as Select from '$lib/components/ui/select';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Badge } from '$lib/components/ui/badge';
  import { Separator } from '$lib/components/ui/separator';
  import { getAgentsByRole, getAgent } from '$lib/agents/catalog';
  import type { AgentType, AgentConfig, ModelId, RouterId } from '$lib/types/session';

  interface WorkerEntry {
    agentType: AgentType;
    name: string;
    config: AgentConfig;
  }

  interface Props {
    workers: WorkerEntry[];
    onAdd: (agentType: AgentType) => void;
    onRemove: (index: number) => void;
    onUpdateName: (index: number, name: string) => void;
    onUpdateConfig: (index: number, config: AgentConfig) => void;
  }

  let { workers, onAdd, onRemove, onUpdateName, onUpdateConfig }: Props = $props();

  const workerAgents = getAgentsByRole('worker');

  const MODEL_OPTIONS: { value: ModelId; label: string }[] = [
    { value: 'claude-opus-4-6', label: 'Claude Opus 4' },
    { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'o3', label: 'o3' },
    { value: 'deepseek-r1', label: 'DeepSeek R1' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  ];

  const ROUTER_OPTIONS: { value: RouterId; label: string }[] = [
    { value: 'direct', label: 'Direct' },
    { value: 'openrouter', label: 'OpenRouter' },
    { value: 'fireworks', label: 'Fireworks' },
  ];

  let expandedIndex = $state<number | null>(null);
  let showPicker = $state(false);

  function toggleExpanded(index: number) {
    expandedIndex = expandedIndex === index ? null : index;
  }

  function handleAdd(agentType: AgentType) {
    onAdd(agentType);
    showPicker = false;
  }

  function updateWorkerModel(index: number, value: string) {
    onUpdateConfig(index, { ...workers[index].config, model: value as ModelId });
  }

  function updateWorkerRouter(index: number, value: string) {
    onUpdateConfig(index, { ...workers[index].config, router: value as RouterId });
  }

  function updateWorkerSystemPrompt(index: number, e: Event) {
    const target = e.target as HTMLTextAreaElement;
    onUpdateConfig(index, { ...workers[index].config, systemPrompt: target.value });
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
      {#each workers as worker, index (index)}
        {@const agent = getAgent(worker.agentType)}
        {@const isExpanded = expandedIndex === index}
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
                  onclick={() => toggleExpanded(index)}
                >
                  {isExpanded ? '▲ Collapse' : '▼ Configure'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  class="text-neutral-500 hover:text-red-400 h-8 w-8 p-0"
                  onclick={() => onRemove(index)}
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
                    onUpdateName(index, (e.target as HTMLInputElement).value)}
                  placeholder="Worker name"
                  class="bg-neutral-900 border-neutral-700 text-white placeholder:text-neutral-500"
                />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <!-- Model Selector -->
                <div class="space-y-2">
                  <Label class="text-neutral-300">Model</Label>
                  <Select.Root
                    type="single"
                    value={worker.config.model}
                    onValueChange={(v: string) => updateWorkerModel(index, v)}
                  >
                    <Select.Trigger
                      class="w-full bg-neutral-900 border-neutral-700 text-white"
                    >
                      {MODEL_OPTIONS.find((m) => m.value === worker.config.model)?.label ??
                        'Select model...'}
                    </Select.Trigger>
                    <Select.Content class="bg-neutral-900 border-neutral-700">
                      {#each MODEL_OPTIONS as opt (opt.value)}
                        <Select.Item value={opt.value} label={opt.label} />
                      {/each}
                    </Select.Content>
                  </Select.Root>
                </div>

                <!-- Router Selector -->
                <div class="space-y-2">
                  <Label class="text-neutral-300">Router</Label>
                  <Select.Root
                    type="single"
                    value={worker.config.router}
                    onValueChange={(v: string) => updateWorkerRouter(index, v)}
                  >
                    <Select.Trigger
                      class="w-full bg-neutral-900 border-neutral-700 text-white"
                    >
                      {ROUTER_OPTIONS.find((r) => r.value === worker.config.router)?.label ??
                        'Select router...'}
                    </Select.Trigger>
                    <Select.Content class="bg-neutral-900 border-neutral-700">
                      {#each ROUTER_OPTIONS as opt (opt.value)}
                        <Select.Item value={opt.value} label={opt.label} />
                      {/each}
                    </Select.Content>
                  </Select.Root>
                </div>
              </div>

              <!-- System Prompt -->
              <div class="space-y-2">
                <Label class="text-neutral-300">System Prompt</Label>
                <Textarea
                  value={worker.config.systemPrompt ?? ''}
                  oninput={(e: Event) => updateWorkerSystemPrompt(index, e)}
                  placeholder="Optional system prompt for this worker..."
                  rows={3}
                  class="bg-neutral-900 border-neutral-700 text-white placeholder:text-neutral-500 resize-none"
                />
              </div>
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
