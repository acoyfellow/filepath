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
  import { MODEL_OPTIONS, ROUTER_OPTIONS } from '$lib/agents/options';
  import type { AgentType, AgentConfig, ModelId, RouterId } from '$lib/types/session';

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

  // Per-worker env var input state, keyed by worker id
  let envKeyInputs = $state<Record<string, string>>({});
  let envValueInputs = $state<Record<string, string>>({});

  function findWorker(id: string): WorkerEntry | undefined {
    return workers.find((w) => w.id === id);
  }

  function getEnvPairs(id: string) {
    const worker = findWorker(id);
    return Object.entries(worker?.config.envVars ?? {}).map(([key, value]) => ({ key, value }));
  }

  function addWorkerEnvVar(id: string) {
    const key = (envKeyInputs[id] ?? '').trim();
    const value = (envValueInputs[id] ?? '').trim();
    if (!key) return;
    const worker = findWorker(id);
    if (!worker) return;
    const existing = worker.config.envVars ?? {};
    onUpdateConfig(id, { ...worker.config, envVars: { ...existing, [key]: value } });
    envKeyInputs[id] = '';
    envValueInputs[id] = '';
  }

  function removeWorkerEnvVar(id: string, key: string) {
    const worker = findWorker(id);
    if (!worker) return;
    const existing = { ...(worker.config.envVars ?? {}) };
    delete existing[key];
    onUpdateConfig(id, { ...worker.config, envVars: existing });
  }

  function toggleExpanded(id: string) {
    expandedId = expandedId === id ? null : id;
  }

  function handleAdd(agentType: AgentType) {
    onAdd(agentType);
    showPicker = false;
  }

  function updateWorkerModel(id: string, value: string) {
    const worker = findWorker(id);
    if (!worker) return;
    onUpdateConfig(id, { ...worker.config, model: value as ModelId });
  }

  function updateWorkerRouter(id: string, value: string) {
    const worker = findWorker(id);
    if (!worker) return;
    onUpdateConfig(id, { ...worker.config, router: value as RouterId });
  }

  function updateWorkerSystemPrompt(id: string, e: Event) {
    const worker = findWorker(id);
    if (!worker) return;
    const target = e.target as HTMLTextAreaElement;
    onUpdateConfig(id, { ...worker.config, systemPrompt: target.value });
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

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <!-- Model Selector -->
                <div class="space-y-2">
                  <Label class="text-neutral-300">Model</Label>
                  <Select.Root
                    type="single"
                    value={worker.config.model}
                    onValueChange={(v: string) => updateWorkerModel(worker.id, v)}
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
                    onValueChange={(v: string) => updateWorkerRouter(worker.id, v)}
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
                  oninput={(e: Event) => updateWorkerSystemPrompt(worker.id, e)}
                  placeholder="Optional system prompt for this worker..."
                  rows={3}
                  class="bg-neutral-900 border-neutral-700 text-white placeholder:text-neutral-500 resize-none"
                />
              </div>

              <!-- Environment Variables -->
              <div class="space-y-3">
                <Label class="text-neutral-300">Environment Variables</Label>

                {#if getEnvPairs(worker.id).length > 0}
                  <div class="space-y-2">
                    {#each getEnvPairs(worker.id) as pair (pair.key)}
                      <div class="flex items-center gap-2">
                        <code class="rounded bg-neutral-800 px-2 py-1 text-sm text-emerald-400 min-w-[120px]">
                          {pair.key}
                        </code>
                        <span class="text-neutral-500">=</span>
                        <code class="rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-300 flex-1 truncate">
                          {pair.value}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          class="text-neutral-500 hover:text-red-400 h-8 w-8 p-0"
                          onclick={() => removeWorkerEnvVar(worker.id, pair.key)}
                        >
                          ✕
                        </Button>
                      </div>
                    {/each}
                  </div>
                {/if}

                <div class="flex items-end gap-2">
                  <div class="space-y-1 flex-1">
                    <Label class="text-xs text-neutral-500">Key</Label>
                    <Input
                      value={envKeyInputs[worker.id] ?? ''}
                      oninput={(e: Event) => (envKeyInputs[worker.id] = (e.target as HTMLInputElement).value)}
                      placeholder="API_KEY"
                      class="bg-neutral-900 border-neutral-700 text-white placeholder:text-neutral-500 h-9"
                    />
                  </div>
                  <div class="space-y-1 flex-1">
                    <Label class="text-xs text-neutral-500">Value</Label>
                    <Input
                      value={envValueInputs[worker.id] ?? ''}
                      oninput={(e: Event) => (envValueInputs[worker.id] = (e.target as HTMLInputElement).value)}
                      placeholder="sk-..."
                      class="bg-neutral-900 border-neutral-700 text-white placeholder:text-neutral-500 h-9"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    class="border-neutral-700 text-neutral-300 hover:bg-neutral-800 h-9"
                    onclick={() => addWorkerEnvVar(worker.id)}
                  >
                    Add
                  </Button>
                </div>
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
