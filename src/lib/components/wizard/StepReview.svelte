<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { Separator } from '$lib/components/ui/separator';
  import { getAgent } from '$lib/agents/catalog';
  import type { AgentType, AgentConfig } from '$lib/types/session';

  interface Props {
    name: string;
    description: string;
    gitRepoUrl: string;
    orchestrator: { agentType: AgentType; config: AgentConfig } | null;
    workers: Array<{ agentType: AgentType; name: string; config: AgentConfig }>;
    isLaunching: boolean;
    onLaunch: () => void;
  }

  let { name, description, gitRepoUrl, orchestrator, workers, isLaunching, onLaunch }: Props = $props();

  let totalContainers = $derived((orchestrator ? 1 : 0) + workers.length);
  let estimatedCostPerMin = $derived((totalContainers * 0.01).toFixed(2));

  function truncate(text: string, max: number): string {
    if (text.length <= max) return text;
    return text.slice(0, max) + '…';
  }

  function envVarCount(config: AgentConfig): number {
    return config.envVars ? Object.keys(config.envVars).length : 0;
  }
</script>

<div class="space-y-6">
  <!-- Session Info -->
  <Card.Root class="border-neutral-800 bg-neutral-950">
    <Card.Header>
      <Card.Title class="text-neutral-100">Session Info</Card.Title>
    </Card.Header>
    <Card.Content class="space-y-2">
      <div class="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
        <span class="text-neutral-400">Name</span>
        <span class="text-neutral-100">{name || '—'}</span>

        <span class="text-neutral-400">Description</span>
        <span class="text-neutral-100">{description || '—'}</span>

        {#if gitRepoUrl}
          <span class="text-neutral-400">Git Repo</span>
          <span class="font-mono text-xs text-neutral-300">{gitRepoUrl}</span>
        {/if}
      </div>
    </Card.Content>
  </Card.Root>

  <!-- Orchestrator -->
  <Card.Root class="border-neutral-800 bg-neutral-950">
    <Card.Header>
      <Card.Title class="text-neutral-100">Orchestrator</Card.Title>
    </Card.Header>
    <Card.Content>
      {#if orchestrator}
        {@const agent = getAgent(orchestrator.agentType)}
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <span class="text-xl">{agent.icon}</span>
            <span class="font-medium text-neutral-100">{agent.name}</span>
            <Badge variant="secondary">{orchestrator.config.model}</Badge>
            <Badge variant="outline">{orchestrator.config.router}</Badge>
          </div>

          {#if orchestrator.config.systemPrompt}
            <p class="text-xs text-neutral-400">
              System prompt: "{truncate(orchestrator.config.systemPrompt, 120)}"
            </p>
          {/if}

          {#if envVarCount(orchestrator.config) > 0}
            <p class="text-xs text-neutral-500">
              {envVarCount(orchestrator.config)} env variable{envVarCount(orchestrator.config) === 1 ? '' : 's'}
            </p>
          {/if}
        </div>
      {:else}
        <p class="text-sm text-neutral-500">No orchestrator selected</p>
      {/if}
    </Card.Content>
  </Card.Root>

  <!-- Workers -->
  <Card.Root class="border-neutral-800 bg-neutral-950">
    <Card.Header>
      <Card.Title class="text-neutral-100">Workers</Card.Title>
      <Card.Description class="text-neutral-400">
        {workers.length} worker{workers.length === 1 ? '' : 's'} configured
      </Card.Description>
    </Card.Header>
    <Card.Content class="space-y-3">
      {#if workers.length === 0}
        <p class="text-sm text-neutral-500">No workers added</p>
      {:else}
        {#each workers as worker, i}
          {#if i > 0}
            <Separator class="bg-neutral-800" />
          {/if}
          {@const agent = getAgent(worker.agentType)}
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="text-lg">{agent.icon}</span>
              <span class="font-medium text-neutral-100">{worker.name}</span>
              <Badge variant="secondary">{worker.config.model}</Badge>
              <Badge variant="outline">{worker.config.router}</Badge>
            </div>

            {#if worker.config.systemPrompt}
              <p class="text-xs text-neutral-400">
                System prompt: "{truncate(worker.config.systemPrompt, 120)}"
              </p>
            {/if}

            {#if envVarCount(worker.config) > 0}
              <p class="text-xs text-neutral-500">
                {envVarCount(worker.config)} env variable{envVarCount(worker.config) === 1 ? '' : 's'}
              </p>
            {/if}
          </div>
        {/each}
      {/if}
    </Card.Content>
  </Card.Root>

  <!-- Cost Estimate -->
  <Card.Root class="border-neutral-800 bg-neutral-950">
    <Card.Header>
      <Card.Title class="text-neutral-100">Cost Estimate</Card.Title>
    </Card.Header>
    <Card.Content>
      <p class="text-sm text-neutral-300">
        $0.01/min × {totalContainers} container{totalContainers === 1 ? '' : 's'} = <span class="font-semibold text-neutral-100">${estimatedCostPerMin}/min</span>
      </p>
    </Card.Content>
  </Card.Root>

  <!-- Launch Button -->
  <div class="flex justify-end">
    <Button
      class="bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 px-8 py-3 text-base font-semibold"
      disabled={isLaunching || totalContainers === 0}
      onclick={onLaunch}
    >
      {#if isLaunching}
        <svg class="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        Launching…
      {:else}
        🚀 Launch Session
      {/if}
    </Button>
  </div>
</div>
