<script lang="ts">
  import { goto } from '$app/navigation';
  import Nav from '$lib/components/Nav.svelte';
  import { Button } from '$lib/components/ui/button';
  import StepBasics from '$lib/components/wizard/StepBasics.svelte';
  import StepOrchestrator from '$lib/components/wizard/StepOrchestrator.svelte';
  import StepWorkers from '$lib/components/wizard/StepWorkers.svelte';
  import StepReview from '$lib/components/wizard/StepReview.svelte';
  import { AGENT_CATALOG } from '$lib/agents/catalog';
  import type { AgentType, AgentConfig, ModelId, RouterId } from '$lib/types/session';

  // Wizard state
  let step = $state<1 | 2 | 3 | 4>(1);
  let name = $state('');
  let description = $state('');
  let gitRepoUrl = $state('');
  let isLaunching = $state(false);
  let launchError = $state<string | null>(null);

  // Orchestrator
  let orchestratorType = $state<AgentType | null>(null);
  let orchestratorConfig = $state<AgentConfig>({
    model: 'claude-sonnet-4',
    router: 'direct',
  });

  // Workers
  let workers = $state<Array<{ id: string; agentType: AgentType; name: string; config: AgentConfig }>>([]);

  // Step validation
  let canProceed = $derived.by(() => {
    switch (step) {
      case 1: return name.trim().length > 0;
      case 2: return orchestratorType !== null;
      case 3: return true; // Workers are optional
      case 4: return !isLaunching;
      default: return false;
    }
  });

  const stepLabels = ['Basics', 'Orchestrator', 'Workers', 'Review'];

  function nextStep() {
    if (step < 4 && canProceed) {
      step = (step + 1) as 1 | 2 | 3 | 4;
    }
  }

  function prevStep() {
    if (step > 1) {
      step = (step - 1) as 1 | 2 | 3 | 4;
    }
  }

  function handleBasicsUpdate(field: 'name' | 'description' | 'gitRepoUrl', value: string) {
    if (field === 'name') name = value;
    else if (field === 'description') description = value;
    else gitRepoUrl = value;
  }

  function handleSelectOrchestrator(type: AgentType) {
    orchestratorType = type;
    const entry = AGENT_CATALOG[type];
    orchestratorConfig = {
      model: entry.defaultModel,
      router: 'direct',
    };
  }

  function handleUpdateOrchestratorConfig(config: AgentConfig) {
    orchestratorConfig = config;
  }

  function handleAddWorker(agentType: AgentType) {
    const entry = AGENT_CATALOG[agentType];
    workers = [...workers, {
      id: crypto.randomUUID(),
      agentType,
      name: `Worker ${workers.length + 1}`,
      config: {
        model: entry.defaultModel,
        router: 'direct',
      },
    }];
  }

  function handleRemoveWorker(id: string) {
    workers = workers.filter((w) => w.id !== id);
  }

  function handleUpdateWorkerName(id: string, newName: string) {
    workers = workers.map((w) => w.id === id ? { ...w, name: newName } : w);
  }

  function handleUpdateWorkerConfig(id: string, config: AgentConfig) {
    workers = workers.map((w) => w.id === id ? { ...w, config } : w);
  }

  async function handleLaunch() {
    if (!orchestratorType) return;
    isLaunching = true;

    try {
      const response = await fetch('/api/session/multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          gitRepoUrl: gitRepoUrl || undefined,
          orchestrator: {
            agentType: orchestratorType,
            config: orchestratorConfig,
          },
          workers,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message || 'Failed to create session');
      }

      const data = await response.json() as { sessionId: string };
      goto(`/session/${data.sessionId}`);
    } catch (err) {
      console.error('Launch failed:', err);
      launchError = err instanceof Error ? err.message : 'Failed to create session';
      isLaunching = false;
    }
  }
</script>

<Nav variant="dashboard" current="new-session" />

<div class="min-h-screen bg-neutral-950 pt-20">
  <div class="max-w-3xl mx-auto px-4 py-8">
    <!-- Progress Steps -->
    <div class="flex items-center justify-center mb-10">
      {#each stepLabels as label, i}
        {@const stepNum = (i + 1) as 1 | 2 | 3 | 4}
        <button
          onclick={() => { if (stepNum < step) step = stepNum; }}
          class="flex items-center {stepNum <= step ? 'cursor-pointer' : 'cursor-default'}"
          disabled={stepNum > step}
          aria-disabled={stepNum > step}
        >
          <div class="flex items-center gap-2">
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors
                {stepNum === step ? 'bg-emerald-500 text-white' : stepNum < step ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/40' : 'bg-neutral-800 text-neutral-500 border border-neutral-700'}"
            >
              {#if stepNum < step}
                ✓
              {:else}
                {stepNum}
              {/if}
            </div>
            <span class="text-sm hidden sm:inline {stepNum === step ? 'text-white font-medium' : stepNum < step ? 'text-emerald-400' : 'text-neutral-500'}">
              {label}
            </span>
          </div>
        </button>
        {#if i < stepLabels.length - 1}
          <div class="w-8 sm:w-16 h-px mx-2 {stepNum < step ? 'bg-emerald-500/50' : 'bg-neutral-700'}"></div>
        {/if}
      {/each}
    </div>

    <!-- Step Content -->
    <div class="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 sm:p-8">
      {#if step === 1}
        <StepBasics {name} {description} {gitRepoUrl} onUpdate={handleBasicsUpdate} />
      {:else if step === 2}
        <StepOrchestrator
          selectedType={orchestratorType}
          config={orchestratorConfig}
          onSelectAgent={handleSelectOrchestrator}
          onUpdateConfig={handleUpdateOrchestratorConfig}
        />
      {:else if step === 3}
        <StepWorkers
          {workers}
          onAdd={handleAddWorker}
          onRemove={handleRemoveWorker}
          onUpdateName={handleUpdateWorkerName}
          onUpdateConfig={handleUpdateWorkerConfig}
        />
      {:else if step === 4}
        <StepReview
          {name}
          {description}
          {gitRepoUrl}
          orchestrator={orchestratorType ? { agentType: orchestratorType, config: orchestratorConfig } : null}
          {workers}
          {isLaunching}
          onLaunch={handleLaunch}
        />
      {/if}
    </div>

    <!-- Error Display -->
    {#if launchError}
      <div class="mt-6 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">
        <div class="flex items-center gap-2">
          <span class="shrink-0">⚠</span>
          <span>{launchError}</span>
          <button
            onclick={() => (launchError = null)}
            class="ml-auto shrink-0 text-red-400 hover:text-red-300"
          >✕</button>
        </div>
      </div>
    {/if}

    <!-- Navigation Buttons -->
    <div class="flex justify-between mt-6">
      <div>
        {#if step > 1}
          <Button
            variant="outline"
            onclick={prevStep}
            class="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
          >
            ← Back
          </Button>
        {:else}
          <Button
            variant="outline"
            onclick={() => goto('/dashboard')}
            class="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
          >
            Cancel
          </Button>
        {/if}
      </div>
      <div>
        {#if step < 4}
          <Button
            onclick={nextStep}
            disabled={!canProceed}
            class="bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
          >
            Next →
          </Button>
        {/if}
      </div>
    </div>
  </div>
</div>
