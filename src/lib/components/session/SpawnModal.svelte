<script lang="ts">
  import { DEFAULT_MODEL } from "$lib/config";
  import { onMount } from "svelte";
  import { canonicalizeStoredModel, type ProviderId } from "$lib/provider-keys";
  import type { AgentHarness, AgentType, SpawnRequest } from "$lib/types/session";

  interface ModelEntry {
    id: string;
    name: string;
    provider: string;
    router: "openrouter" | "zen";
  }
  
  interface Props {
    onclose: () => void;
    onspawn: (req: SpawnRequest) => void;
    lastAgent?: AgentType;
    lastModel?: string;
    accountKeysMasked?: Record<ProviderId, string | null>;
    accountKeysError?: string | null;
  }
  
  let {
    onclose,
    onspawn,
    lastAgent = "shelley",
    lastModel = DEFAULT_MODEL,
    accountKeysMasked = { openrouter: null, zen: null },
    accountKeysError = null,
  }: Props = $props();

  const NAMES = ["atlas","bolt","cipher","drift","echo","flux","ghost","helix","iris","kite","nova","orbit","pulse","relay","spark","trace","vortex","wave","zero"];
  function pickName(): string {
    const word = NAMES[Math.floor(Math.random() * NAMES.length)];
    const num = Math.floor(Math.random() * 99);
    return `${word}-${num}`;
  }

  function createInitialSpawnState() {
    const initialModel = canonicalizeStoredModel(lastModel);
    const initialHasAccountKey = Object.values(accountKeysMasked).some(Boolean);

    return {
      agent: lastAgent,
      model: initialModel,
      hasAccountKey: initialHasAccountKey,
      availableModels: [
        {
          id: initialModel || DEFAULT_MODEL,
          name: initialModel || DEFAULT_MODEL,
          provider: "Unknown",
          router: initialModel.startsWith("zen/") ? "zen" : "openrouter",
        },
      ] satisfies ModelEntry[],
    };
  }

  const initialSpawnState = createInitialSpawnState();

  let name = $state(pickName());
  let agent = $state<AgentType>(initialSpawnState.agent);
  let model = $state(initialSpawnState.model);
  let modelFilter = $state("");
  let modelsLoading = $state(true);
  let modelsError = $state("");
  let modelWarnings = $state<string[]>([]);
  let availableModels = $state<ModelEntry[]>(initialSpawnState.availableModels);
  let harnessesLoading = $state(true);
  let harnessesError = $state("");
  let availableHarnesses = $state<AgentHarness[]>([]);

  let hasAccountKey = $derived(Object.values(accountKeysMasked).some(Boolean));
  let keyMode = $state<'account' | 'session'>(initialSpawnState.hasAccountKey ? 'account' : 'session');
  let sessionKey = $state('');
  let keyLoading = $state(false); // Already have the data from server
  let availableRouters = $derived(
    Object.entries(accountKeysMasked)
      .filter(([, value]) => Boolean(value))
      .map(([provider, value]) => `${provider} (${value})`)
  );

  let filteredModels = $derived(
    modelFilter
      ? availableModels.filter((entry) =>
          `${entry.id} ${entry.name} ${entry.provider} ${entry.router}`
            .toLowerCase()
            .includes(modelFilter.toLowerCase()),
        )
      : availableModels
  );

  onMount(async () => {
    try {
      const response = await fetch("/api/harnesses");
      const data = await response.json().catch(() => ({})) as {
        harnesses?: AgentHarness[];
        error?: string;
      };

      if (!response.ok) {
        harnessesError = data.error ?? "Harness catalog unavailable";
      } else {
        const harnesses = (data.harnesses ?? []).filter((entry) => entry.enabled);
        availableHarnesses = harnesses;
        if (harnesses.length > 0 && !harnesses.some((entry) => entry.id === agent)) {
          agent = harnesses[0].id;
        }
      }
    } catch {
      harnessesError = "Harness catalog unavailable";
    } finally {
      harnessesLoading = false;
    }

    try {
      const response = await fetch("/api/models");
      const data = await response.json().catch(() => ({})) as {
        error?: string;
        warnings?: string[];
        models?: ModelEntry[];
      };

      modelWarnings = data.warnings ?? [];

      if (!response.ok) {
        modelsError = data.error ?? "Model catalog unavailable";
        return;
      }

      const models = data.models ?? [];
      const selected = model || DEFAULT_MODEL;
      const uniqueModels = new Map(models.map((entry) => [entry.id, entry]));

      if (selected && !uniqueModels.has(selected)) {
        uniqueModels.set(selected, {
          id: selected,
          name: selected,
          provider: "Unknown",
          router: selected.startsWith("zen/") ? "zen" : "openrouter",
        });
      }

      availableModels = Array.from(uniqueModels.values());
    } catch {
      modelsError = "Model catalog unavailable";
    } finally {
      modelsLoading = false;
    }
  });

  function handleSpawn() {
    if (!name.trim()) return;
    const req: SpawnRequest = { name: name.trim(), agentType: agent, model };
    if (keyMode === 'session' && sessionKey.trim()) {
      req.apiKey = sessionKey.trim();
    }
    onspawn(req);
  }

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }

  function handleBackdropKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onclose();
    }
  }

  function stopModalKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onclose();
      return;
    }
    e.stopPropagation();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-bg" onclick={handleBackdrop} onkeydown={handleBackdropKeydown}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="spawn-thread-title"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onkeydown={stopModalKeydown}
  >
    <div class="modal-title" id="spawn-thread-title">spawn thread</div>
    <div class="modal-body">
      <label class="modal-label" for="spawn-name">name</label>
      <div class="modal-name-row">
        <input id="spawn-name" bind:value={name} class="modal-input" />
        <button class="modal-dice" onclick={() => { name = pickName(); }} aria-label="Generate name">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round">
            <path d="M1 6a5 5 0 018-4M11 6a5 5 0 01-8 4" />
            <path d="M9 1v2h2M3 11V9H1" />
          </svg>
        </button>
      </div>

      <div class="modal-label">agent harness</div>
      {#if harnessesError}
        <div class="modal-key-info modal-model-state">{harnessesError}</div>
      {/if}
      <div class="modal-options">
        {#if harnessesLoading}
          <div class="modal-key-info">Loading harnesses...</div>
        {:else}
          {#each availableHarnesses as harness}
            <button class="modal-option" class:on={agent === harness.id} onclick={() => { agent = harness.id; }}>
              {harness.name}
            </button>
          {/each}
        {/if}
      </div>

      <label class="modal-label" for="spawn-model-filter">model</label>
      <input
        id="spawn-model-filter"
        class="modal-input modal-model-filter"
        placeholder={modelsLoading ? "Loading models..." : "Search live models..."}
        bind:value={modelFilter}
        onfocus={() => { modelFilter = ""; }}
      />
      {#if modelsError}
        <div class="modal-key-info modal-model-state">{modelsError}</div>
      {:else if modelWarnings.length > 0}
        <div class="modal-key-info modal-model-state">{modelWarnings.join(" · ")}</div>
      {/if}
      <div class="modal-options">
        {#each filteredModels as m}
          <button class="modal-option" class:on={model === m.id} onclick={() => { model = m.id; modelFilter = ""; }}>
            {m.id}
          </button>
        {/each}
      </div>

      <div class="modal-label">api key</div>
      {#if accountKeysError}
        <div class="modal-key-info modal-key-error">
          Saved account router keys are unreadable. Use a session key or re-save your keys in Settings.
        </div>
      {/if}
      {#if keyLoading}
        <div class="modal-key-info">loading...</div>
      {:else if hasAccountKey}
        <div class="modal-options">
          <button class="modal-option" class:on={keyMode === 'account'} onclick={() => { keyMode = 'account'; }}>
            saved account key{availableRouters.length > 1 ? "s" : ""} ({availableRouters.join(", ")})
          </button>
          <button class="modal-option" class:on={keyMode === 'session'} onclick={() => { keyMode = 'session'; }}>
            different key
          </button>
        </div>
        {#if keyMode === 'session'}
          <input
            class="modal-input modal-key-input"
            type="password"
            placeholder="Paste the key for the router this model uses"
            bind:value={sessionKey}
          />
        {/if}
      {:else}
        <input
          class="modal-input modal-key-input"
          type="password"
          placeholder="Paste an OpenRouter or Zen key"
          bind:value={sessionKey}
        />
        <div class="modal-key-info">
          No account key set. <a href="/settings/account" class="modal-key-link">Add one in Settings</a> or enter one for this session.
        </div>
      {/if}
    </div>
    <div class="modal-footer">
      <button class="modal-cancel" onclick={onclose}>cancel</button>
      <button class="modal-go" onclick={handleSpawn}>spawn thread</button>
    </div>
  </div>
</div>

<style>
  .modal-bg {
    position: fixed;
    inset: 0;
    background: var(--overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    backdrop-filter: blur(2px);
  }
  .modal {
    width: 340px;
    background: var(--modal-bg);
    border: 1px solid var(--b2);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: var(--shadow);
  }
  .modal-title {
    padding: 14px 18px 8px;
    font-family: var(--m);
    font-size: 13px;
    font-weight: 600;
    color: var(--t1);
  }
  .modal-body {
    padding: 0 18px 14px;
  }
  .modal-label {
    display: block;
    font-family: var(--m);
    font-size: 9px;
    color: var(--t4);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 10px 0 4px;
  }
  .modal-label:first-child {
    margin-top: 0;
  }
  .modal-name-row {
    display: flex;
    gap: 6px;
  }
  .modal-input {
    flex: 1;
    background: var(--bg3);
    border: 1px solid var(--b2);
    border-radius: 7px;
    padding: 8px 12px;
    color: var(--t1);
    font-family: var(--m);
    font-size: 12px;
    outline: none;
  }
  .modal-input:focus {
    border-color: var(--t5);
  }
  .modal-input::placeholder {
    color: var(--t5);
  }
  .modal-model-filter {
    margin-bottom: 6px;
  }
  .modal-dice {
    background: var(--bg3);
    border: 1px solid var(--b2);
    border-radius: 7px;
    padding: 0 10px;
    color: var(--t4);
    cursor: pointer;
    display: flex;
    align-items: center;
  }
  .modal-dice:hover {
    border-color: var(--t5);
  }
  .modal-options {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .modal-option {
    padding: 6px 11px;
    background: var(--bg3);
    border: 1px solid var(--b2);
    border-radius: 6px;
    cursor: pointer;
    font-family: var(--m);
    font-size: 11px;
    color: var(--t4);
    transition: all 0.1s;
  }
  .modal-option:hover {
    border-color: var(--t5);
    color: var(--t3);
  }
  .modal-option.on {
    background: color-mix(in srgb, var(--accent) 10%, var(--bg));
    border-color: color-mix(in srgb, var(--accent) 25%, transparent);
    color: var(--t1);
  }
  .modal-footer {
    padding: 10px 18px 14px;
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    border-top: 1px solid var(--b1);
  }
  .modal-cancel {
    background: none;
    border: 1px solid var(--b2);
    color: var(--t4);
    padding: 6px 14px;
    border-radius: 7px;
    font-family: var(--m);
    font-size: 11px;
    cursor: pointer;
  }
  .modal-go {
    background: var(--accent);
    border: none;
    color: #fff;
    padding: 6px 18px;
    border-radius: 7px;
    font-family: var(--m);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }
  .modal-key-input {
    margin-top: 6px;
    font-family: monospace;
    font-size: 11px;
  }
  .modal-key-info {
    font-family: var(--m);
    font-size: 10px;
    color: var(--t5);
    margin-top: 4px;
    line-height: 1.4;
  }
  .modal-key-error {
    color: #dc2626;
  }
  .modal-key-link {
    color: var(--t3);
    text-decoration: underline;
  }
  .modal-key-link:hover {
    color: var(--t1);
  }
</style>
