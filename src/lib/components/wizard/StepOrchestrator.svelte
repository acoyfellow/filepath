<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import * as Select from '$lib/components/ui/select';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Textarea } from '$lib/components/ui/textarea';
  import { getAgentsByRole } from '$lib/agents/catalog';
  import { MODEL_OPTIONS, ROUTER_OPTIONS } from '$lib/agents/options';
  import type { AgentType, AgentConfig, ModelId, RouterId } from '$lib/types/session';

  interface Props {
    selectedType: AgentType | null;
    config: AgentConfig;
    onSelectAgent: (type: AgentType) => void;
    onUpdateConfig: (config: AgentConfig) => void;
  }

  let { selectedType, config, onSelectAgent, onUpdateConfig }: Props = $props();

  const orchestrators = getAgentsByRole('orchestrator');



  // Local state for env var editor
  let envKeyInput = $state('');
  let envValueInput = $state('');

  let envPairs = $derived(
    Object.entries(config.envVars ?? {}).map(([key, value]) => ({ key, value }))
  );

  function handleSelectAgent(agent: AgentType) {
    const entry = orchestrators.find((a) => a.id === agent);
    if (entry) {
      onSelectAgent(agent);
      onUpdateConfig({
        ...config,
        model: entry.defaultModel,
        router: entry.defaultRouter,
      });
    }
  }

  function updateModel(value: string) {
    onUpdateConfig({ ...config, model: value as ModelId });
  }

  function updateRouter(value: string) {
    onUpdateConfig({ ...config, router: value as RouterId });
  }

  function updateSystemPrompt(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    onUpdateConfig({ ...config, systemPrompt: target.value });
  }

  function addEnvVar() {
    const key = envKeyInput.trim();
    const value = envValueInput.trim();
    if (!key) return;
    const existing = config.envVars ?? {};
    onUpdateConfig({ ...config, envVars: { ...existing, [key]: value } });
    envKeyInput = '';
    envValueInput = '';
  }

  function removeEnvVar(key: string) {
    const existing = { ...(config.envVars ?? {}) };
    delete existing[key];
    onUpdateConfig({ ...config, envVars: existing });
  }
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-xl font-semibold text-white mb-1">Choose Orchestrator</h2>
    <p class="text-sm text-neutral-400">Select the agent that will coordinate your session.</p>
  </div>

  <!-- Agent Cards Grid -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {#each orchestrators as agent (agent.id)}
      {@const isSelected = selectedType === agent.id}
      <button
        type="button"
        class="text-left focus:outline-none"
        onclick={() => handleSelectAgent(agent.id)}
      >
        <Card.Root
          class="bg-neutral-900 transition-colors cursor-pointer hover:bg-neutral-800 {isSelected
            ? 'border-emerald-500 border-2'
            : 'border-neutral-700'}"
        >
          <Card.Header>
            <Card.Title class="flex items-center gap-2 text-white">
              <span class="text-2xl">{agent.icon}</span>
              <span>{agent.name}</span>
            </Card.Title>
          </Card.Header>
          <Card.Content>
            <Card.Description class="text-neutral-400">
              {agent.description}
            </Card.Description>
          </Card.Content>
        </Card.Root>
      </button>
    {/each}
  </div>

  <!-- Configuration Section -->
  {#if selectedType}
    <div class="space-y-5 rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
      <h3 class="text-lg font-medium text-white">Configure Orchestrator</h3>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <!-- Model Selector -->
        <div class="space-y-2">
          <Label class="text-neutral-300">Model</Label>
          <Select.Root type="single" value={config.model} onValueChange={updateModel}>
            <Select.Trigger class="w-full bg-neutral-900 border-neutral-700 text-white">
              {MODEL_OPTIONS.find((m) => m.value === config.model)?.label ?? 'Select model...'}
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
          <Select.Root type="single" value={config.router} onValueChange={updateRouter}>
            <Select.Trigger class="w-full bg-neutral-900 border-neutral-700 text-white">
              {ROUTER_OPTIONS.find((r) => r.value === config.router)?.label ?? 'Select router...'}
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
          value={config.systemPrompt ?? ''}
          oninput={updateSystemPrompt}
          placeholder="Optional system prompt for the orchestrator..."
          rows={4}
          class="bg-neutral-900 border-neutral-700 text-white placeholder:text-neutral-500 resize-none"
        />
      </div>

      <!-- Environment Variables -->
      <div class="space-y-3">
        <Label class="text-neutral-300">Environment Variables</Label>

        {#if envPairs.length > 0}
          <div class="space-y-2">
            {#each envPairs as pair (pair.key)}
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
                  onclick={() => removeEnvVar(pair.key)}
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
              value={envKeyInput}
              oninput={(e: Event) => (envKeyInput = (e.target as HTMLInputElement).value)}
              placeholder="API_KEY"
              class="bg-neutral-900 border-neutral-700 text-white placeholder:text-neutral-500 h-9"
            />
          </div>
          <div class="space-y-1 flex-1">
            <Label class="text-xs text-neutral-500">Value</Label>
            <Input
              value={envValueInput}
              oninput={(e: Event) => (envValueInput = (e.target as HTMLInputElement).value)}
              placeholder="sk-..."
              class="bg-neutral-900 border-neutral-700 text-white placeholder:text-neutral-500 h-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            class="border-neutral-700 text-neutral-300 hover:bg-neutral-800 h-9"
            onclick={addEnvVar}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  {/if}
</div>
