<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import { getAgentsByRole } from '$lib/agents/catalog';
  import AgentConfigEditor from './AgentConfigEditor.svelte';
  import type { AgentType, AgentConfig } from '$lib/types/session';

  interface Props {
    selectedType: AgentType | null;
    config: AgentConfig;
    onSelectAgent: (type: AgentType) => void;
    onUpdateConfig: (config: AgentConfig) => void;
  }

  let { selectedType, config, onSelectAgent, onUpdateConfig }: Props = $props();

  const orchestrators = getAgentsByRole('orchestrator');

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

      <AgentConfigEditor
        {config}
        {onUpdateConfig}
        promptPlaceholder="Optional system prompt for the orchestrator..."
        promptRows={4}
      />
    </div>
  {/if}
</div>
