<script lang="ts">
  import { DEFAULT_MODEL } from "$lib/config";
  import { onMount } from "svelte";
  import {
    PROVIDERS,
    PROVIDER_IDS,
    canonicalizeStoredModel,
    getProviderForModel,
    type ProviderId,
  } from "$lib/provider-keys";
  import type { AgentHarness, HarnessId, SpawnRequest } from "$lib/types/session";

  interface ModelEntry {
    id: string;
    name: string;
    provider: string;
    router: ProviderId;
  }

  interface Props {
    onclose: () => void;
    onspawn: (req: SpawnRequest) => Promise<void> | void;
    lastAgent?: HarnessId;
    lastModel?: string;
    accountKeysMasked?: Record<ProviderId, string | null>;
    accountKeysError?: string | null;
  }

  const EMPTY_KEYS: Record<ProviderId, string | null> = {
    openrouter: null,
    zen: null,
  };

  let {
    onclose,
    onspawn,
    lastAgent = "shelley",
    lastModel = DEFAULT_MODEL,
    accountKeysMasked = EMPTY_KEYS,
    accountKeysError = null,
  }: Props = $props();

  const NAMES = ["atlas", "bolt", "cipher", "drift", "echo", "flux", "ghost", "helix", "iris", "kite", "nova", "orbit", "pulse", "relay", "spark", "trace", "vortex", "wave", "zero"];

  function pickName(): string {
    const word = NAMES[Math.floor(Math.random() * NAMES.length)];
    const num = Math.floor(Math.random() * 99);
    return `${word}-${num}`;
  }

  function cloneMaskedKeys(source: Record<ProviderId, string | null>): Record<ProviderId, string | null> {
    return {
      openrouter: source.openrouter ?? null,
      zen: source.zen ?? null,
    };
  }

  function getInitialPreferredModel() {
    return canonicalizeStoredModel(lastModel);
  }

  function getInitialMaskedKeys() {
    return cloneMaskedKeys(accountKeysMasked);
  }

  function getInitialHarness() {
    return lastAgent;
  }

  function getInitialAccountKeysError() {
    return accountKeysError ?? "";
  }

  const preferredModel = getInitialPreferredModel();
  const initialKeys = getInitialMaskedKeys();
  const initialHasAccountKey = Object.values(initialKeys).some(Boolean);

  let name = $state(pickName());
  let agent = $state<HarnessId>(getInitialHarness());
  let model = $state(initialHasAccountKey ? preferredModel : "");
  let modelFilter = $state("");
  let accountKeys = $state<Record<ProviderId, string | null>>(initialKeys);
  let accountKeysStateError = $state(getInitialAccountKeysError());

  let modelsLoading = $state(initialHasAccountKey);
  let modelsError = $state("");
  let modelWarnings = $state<string[]>([]);
  let availableModels = $state<ModelEntry[]>([]);

  let harnessesLoading = $state(true);
  let harnessesError = $state("");
  let availableHarnesses = $state<AgentHarness[]>([]);

  let inlineKeyDraft = $state("");
  let inlineKeySaving = $state(false);
  let inlineKeyError = $state("");
  let inlineKeySuccess = $state("");

  let spawnError = $state("");
  let spawning = $state(false);

  let hasAnyAccountKey = $derived(Object.values(accountKeys).some(Boolean));
  let selectedHarness = $derived(
    availableHarnesses.find((entry) => entry.id === agent) ?? null,
  );
  let availableRouters = $derived(
    Object.entries(accountKeys)
      .filter(([, value]) => Boolean(value))
      .map(([provider, value]) => `${PROVIDERS[provider as ProviderId].label} (${value})`),
  );

  let activeProvider = $derived.by<ProviderId>(() => {
    if (model) {
      return getProviderForModel(model);
    }

    return PROVIDER_IDS.find((provider) => accountKeys[provider]) ?? "openrouter";
  });

  let activeProviderDefinition = $derived(PROVIDERS[activeProvider]);
  let hasSelectedProviderKey = $derived(Boolean(accountKeys[activeProvider]));

  let filteredModels = $derived(
    modelFilter.trim()
      ? availableModels.filter((entry) =>
          `${entry.id} ${entry.name} ${entry.provider} ${entry.router}`
            .toLowerCase()
            .includes(modelFilter.trim().toLowerCase()),
        )
      : availableModels,
  );

  let selectedModelEntry = $derived(
    availableModels.find((entry) => entry.id === model) ?? null,
  );

  let setupSummary = $derived.by(() => {
    if (accountKeysStateError) {
      return "Re-save your account router key to unlock models and spawn.";
    }
    if (!hasSelectedProviderKey) {
      return `Save a ${activeProviderDefinition.label} key, then choose a model and spawn.`;
    }
    if (!model) {
      return "Choose a model before spawning this agent.";
    }
    return "This agent is ready to spawn into the current session.";
  });

  let modelSelectPlaceholder = $derived.by(() => {
    if (!hasAnyAccountKey) {
      return `Save a ${activeProviderDefinition.label} key to unlock models`;
    }
    if (modelsLoading) {
      return "Loading live models...";
    }
    if (modelsError) {
      return "Model catalog unavailable";
    }
    return "Choose a model";
  });

  let spawnBlocker = $derived.by(() => {
    if (!name.trim()) return "Name is required";
    if (harnessesLoading) return "Loading harnesses...";
    if (harnessesError) return harnessesError;
    if (!agent) return "Choose an agent harness";
    if (accountKeysStateError) return "Re-save your router key before spawning";
    if (!hasSelectedProviderKey) return `Add a ${activeProviderDefinition.label} key to continue`;
    if (modelsLoading) return "Loading live models...";
    if (modelsError) return modelsError;
    if (!model) return "Choose a model";
    return null;
  });

  async function loadHarnesses() {
    harnessesLoading = true;
    harnessesError = "";

    try {
      const response = await fetch("/api/harnesses");
      const data = await response.json().catch(() => ({})) as {
        harnesses?: AgentHarness[];
        error?: string;
      };

      if (!response.ok) {
        harnessesError = data.error ?? "Harness catalog unavailable";
        availableHarnesses = [];
        return;
      }

      const harnesses = (data.harnesses ?? []).filter((entry) => entry.enabled);
      availableHarnesses = harnesses;
      if (harnesses.length > 0 && !harnesses.some((entry) => entry.id === agent)) {
        agent = harnesses[0].id;
      }
    } catch {
      harnessesError = "Harness catalog unavailable";
      availableHarnesses = [];
    } finally {
      harnessesLoading = false;
    }
  }

  async function loadModels() {
    if (!hasAnyAccountKey) {
      modelsLoading = false;
      modelsError = "";
      modelWarnings = [];
      availableModels = [];
      model = "";
      return;
    }

    modelsLoading = true;
    modelsError = "";
    modelWarnings = [];

    try {
      const response = await fetch("/api/models");
      const data = await response.json().catch(() => ({})) as {
        error?: string;
        message?: string;
        warnings?: string[];
        models?: ModelEntry[];
      };

      modelWarnings = data.warnings ?? [];

      if (!response.ok) {
        modelsError = data.error ?? data.message ?? "Model catalog unavailable";
        availableModels = [];
        model = "";
        return;
      }

      const models = data.models ?? [];
      const uniqueModels = new Map(models.map((entry) => [entry.id, entry]));
      availableModels = Array.from(uniqueModels.values());

      if (model && uniqueModels.has(model)) {
        return;
      }

      const harnessDefault = selectedHarness?.defaultModel
        ? canonicalizeStoredModel(selectedHarness.defaultModel)
        : "";
      if (harnessDefault && uniqueModels.has(harnessDefault)) {
        model = harnessDefault;
        return;
      }

      model = uniqueModels.has(preferredModel) ? preferredModel : "";
    } catch {
      modelsError = "Model catalog unavailable";
      availableModels = [];
      model = "";
    } finally {
      modelsLoading = false;
    }
  }

  async function saveInlineKey() {
    if (inlineKeySaving || !inlineKeyDraft.trim()) return;

    inlineKeySaving = true;
    inlineKeyError = "";
    inlineKeySuccess = "";

    try {
      const response = await fetch("/api/user/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: activeProvider,
          key: inlineKeyDraft.trim(),
        }),
      });

      const data = await response.json().catch(() => ({})) as {
        message?: string;
        keys?: Record<ProviderId, string | null>;
      };

      if (!response.ok) {
        inlineKeyError = data.message ?? `Failed to save ${activeProviderDefinition.label} key`;
        return;
      }

      accountKeys = cloneMaskedKeys(data.keys ?? EMPTY_KEYS);
      accountKeysStateError = "";
      inlineKeyDraft = "";
      inlineKeySuccess = `${activeProviderDefinition.label} key saved`;
      await loadModels();
    } catch (error) {
      inlineKeyError = error instanceof Error ? error.message : `Failed to save ${activeProviderDefinition.label} key`;
    } finally {
      inlineKeySaving = false;
    }
  }

  async function handleSpawn() {
    spawnError = "";

    if (spawnBlocker) {
      spawnError = spawnBlocker;
      return;
    }

    spawning = true;
    try {
      await Promise.resolve(onspawn({
        name: name.trim(),
        harnessId: agent,
        model,
      }));
    } catch (error) {
      spawnError = error instanceof Error ? error.message : "Failed to spawn agent";
    } finally {
      spawning = false;
    }
  }

  function handleBackdrop(event: MouseEvent) {
    if (event.target === event.currentTarget) onclose();
  }

  function handleBackdropKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onclose();
    }
  }

  function stopModalKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onclose();
      return;
    }
    event.stopPropagation();
  }

  onMount(async () => {
    await Promise.all([loadHarnesses(), loadModels()]);
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-bg" onclick={handleBackdrop} onkeydown={handleBackdropKeydown}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="spawn-agent-title"
    tabindex="-1"
    onclick={(event) => event.stopPropagation()}
    onkeydown={stopModalKeydown}
  >
    <div class="modal-title" id="spawn-agent-title">spawn agent</div>
    <div class="modal-body">
      <div class="modal-banner modal-banner-setup">{setupSummary}</div>

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
        <div class="modal-banner modal-banner-error">{harnessesError}</div>
      {/if}
      <div class="modal-options modal-options-harness">
        {#if harnessesLoading}
          <div class="modal-placeholder">Loading harnesses...</div>
        {:else}
          {#each availableHarnesses as harness}
            <button
              class="modal-option"
              class:on={agent === harness.id}
              onclick={() => {
                agent = harness.id;
                const defaultModel = canonicalizeStoredModel(harness.defaultModel);
                if (availableModels.some((entry) => entry.id === defaultModel)) {
                  model = defaultModel;
                }
              }}
            >
              {harness.name}
            </button>
          {/each}
        {/if}
      </div>
      {#if selectedHarness}
        <div class="modal-meta">
          {selectedHarness.description}
        </div>
      {/if}

      <div class="modal-label">router access</div>
      {#if accountKeysStateError}
        <div class="modal-banner modal-banner-error">
          {accountKeysStateError}
        </div>
      {/if}

      {#if hasSelectedProviderKey}
        <div class="modal-key-card modal-key-card-ready">
          <div class="modal-key-title">Ready to load live models</div>
          <div class="modal-key-copy">
            Using saved {activeProviderDefinition.label} access for this agent.
          </div>
          <div class="modal-options">
            <button class="modal-option on" disabled>
              account router key{availableRouters.length > 1 ? "s" : ""} ({availableRouters.join(", ")})
            </button>
          </div>
        </div>
      {:else}
        <div class="modal-key-card">
          <div class="modal-key-head">
            <div>
              <div class="modal-key-title">Save {activeProviderDefinition.label} access here</div>
              <div class="modal-key-copy">
                This is required before model selection and spawn.
              </div>
            </div>
            <a href={activeProviderDefinition.docsUrl} class="modal-key-link" target="_blank" rel="noopener">
              get key
            </a>
          </div>

          <div class="modal-key-row">
            <input
              class="modal-input"
              type="password"
              placeholder={activeProviderDefinition.keyPlaceholder}
              bind:value={inlineKeyDraft}
            />
            <button
              class="modal-save"
              onclick={saveInlineKey}
              disabled={inlineKeySaving || !inlineKeyDraft.trim()}
            >
              {inlineKeySaving ? "saving..." : "save key"}
            </button>
          </div>

          <div class="modal-key-copy">
            Stored to your account and reused for future agent spawns.
            <a href="/settings/account" class="modal-key-link">Manage keys in Settings</a>
          </div>

          {#if inlineKeyError}
            <div class="modal-banner modal-banner-error">{inlineKeyError}</div>
          {/if}
          {#if inlineKeySuccess}
            <div class="modal-banner modal-banner-success">{inlineKeySuccess}</div>
          {/if}
        </div>
      {/if}

      <label class="modal-label" for="spawn-model-search">model</label>
      <div class="modal-section">
        <div class="modal-combo-row">
          <input
            id="spawn-model-search"
            class="modal-input"
            placeholder={hasAnyAccountKey ? "Search models..." : `Save a ${activeProviderDefinition.label} key first`}
            bind:value={modelFilter}
            disabled={!hasAnyAccountKey || modelsLoading}
          />
          <button
            class="modal-clear"
            onclick={() => {
              model = "";
              modelFilter = "";
            }}
            disabled={!model}
            aria-label="Clear selected model"
          >
            clear
          </button>
        </div>

        <select
          class="modal-select"
          bind:value={model}
          disabled={!hasAnyAccountKey || modelsLoading || availableModels.length === 0}
        >
          <option value="">{modelSelectPlaceholder}</option>
          {#each filteredModels as entry}
            <option value={entry.id}>
              {entry.name} · {entry.id}
            </option>
          {/each}
        </select>

        {#if modelsError}
          <div class="modal-banner modal-banner-error">{modelsError}</div>
        {:else if modelWarnings.length > 0}
          <div class="modal-banner">{modelWarnings.join(" · ")}</div>
        {:else if !hasAnyAccountKey}
          <div class="modal-banner">
            Save router access above to unlock the live model catalog here.
          </div>
        {:else if !modelsLoading}
          <div class="modal-meta">
            {filteredModels.length} of {availableModels.length} models
          </div>
        {/if}

        {#if selectedModelEntry}
          <div class="modal-selection">
            <span class="modal-selection-label">selected</span>
            <span class="modal-selection-value">{selectedModelEntry.id}</span>
          </div>
        {:else if selectedHarness && hasAnyAccountKey}
          <div class="modal-meta">
            Default for {selectedHarness.name}: {selectedHarness.defaultModel}
          </div>
        {/if}
      </div>
    </div>

    <div class="modal-footer">
      {#if spawnError}
        <div class="modal-footer-error">{spawnError}</div>
      {/if}
      <button class="modal-cancel" onclick={onclose}>cancel</button>
      <button
        class="modal-go"
        onclick={handleSpawn}
        disabled={Boolean(spawnBlocker) || spawning}
        title={spawnBlocker ?? ""}
      >
        {spawning ? "spawning..." : "spawn agent"}
      </button>
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
    width: min(460px, calc(100vw - 32px));
    background: var(--modal-bg);
    border: 1px solid var(--b2);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: var(--shadow);
  }

  .modal-title {
    padding: 16px 20px 10px;
    font-family: var(--m);
    font-size: 13px;
    font-weight: 600;
    color: var(--t1);
  }

  .modal-body {
    padding: 0 20px 18px;
  }

  .modal-label {
    display: block;
    font-family: var(--m);
    font-size: 9px;
    color: var(--t4);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 12px 0 6px;
  }

  .modal-label:first-child {
    margin-top: 0;
  }

  .modal-name-row,
  .modal-combo-row,
  .modal-key-row {
    display: flex;
    gap: 8px;
  }

  .modal-input,
  .modal-select {
    width: 100%;
    background: var(--bg3);
    border: 1px solid var(--b2);
    border-radius: 9px;
    padding: 10px 12px;
    color: var(--t1);
    font-family: var(--m);
    font-size: 12px;
    outline: none;
  }

  .modal-select {
    appearance: auto;
    min-height: 40px;
  }

  .modal-input:focus,
  .modal-select:focus {
    border-color: var(--t5);
  }

  .modal-input:disabled,
  .modal-select:disabled,
  .modal-go:disabled,
  .modal-save:disabled,
  .modal-clear:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .modal-input::placeholder {
    color: var(--t5);
  }

  .modal-section {
    display: grid;
    gap: 8px;
  }

  .modal-options {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .modal-options-harness {
    min-height: 42px;
    align-items: flex-start;
  }

  .modal-option {
    padding: 7px 11px;
    background: var(--bg3);
    border: 1px solid var(--b2);
    border-radius: 8px;
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

  .modal-banner,
  .modal-meta,
  .modal-key-copy,
  .modal-placeholder,
  .modal-footer-error {
    font-family: var(--m);
    font-size: 10px;
    line-height: 1.45;
  }

  .modal-banner,
  .modal-key-card {
    border: 1px solid var(--b2);
    border-radius: 10px;
    background: color-mix(in srgb, var(--bg3) 82%, transparent);
  }

  .modal-banner {
    padding: 8px 10px;
    color: var(--t4);
  }

  .modal-banner-error,
  .modal-footer-error {
    color: #dc2626;
  }

  .modal-banner-success {
    color: #15803d;
  }

  .modal-meta {
    color: var(--t5);
  }

  .modal-selection {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--accent) 7%, var(--bg3));
    border: 1px solid color-mix(in srgb, var(--accent) 18%, transparent);
  }

  .modal-selection-label {
    font-family: var(--m);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--t5);
  }

  .modal-selection-value {
    font-family: var(--m);
    font-size: 11px;
    color: var(--t1);
  }

  .modal-placeholder {
    display: flex;
    align-items: center;
    min-height: 40px;
    color: var(--t5);
  }

  .modal-dice,
  .modal-clear,
  .modal-save,
  .modal-cancel,
  .modal-go {
    border-radius: 9px;
    font-family: var(--m);
    font-size: 11px;
    transition: all 0.1s ease;
  }

  .modal-dice,
  .modal-clear {
    background: var(--bg3);
    border: 1px solid var(--b2);
    color: var(--t4);
    padding: 0 11px;
    cursor: pointer;
  }

  .modal-dice:hover,
  .modal-clear:hover:not(:disabled),
  .modal-cancel:hover {
    border-color: var(--t5);
    color: var(--t2);
  }

  .modal-key-card {
    padding: 12px;
    display: grid;
    gap: 10px;
  }

  .modal-key-card-ready {
    background: color-mix(in srgb, var(--accent) 6%, var(--bg3));
  }

  .modal-key-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .modal-key-title {
    font-family: var(--m);
    font-size: 11px;
    color: var(--t1);
  }

  .modal-key-copy {
    color: var(--t5);
  }

  .modal-key-link {
    color: var(--t3);
    text-decoration: underline;
  }

  .modal-key-link:hover {
    color: var(--t1);
  }

  .modal-save {
    border: none;
    background: color-mix(in srgb, var(--accent) 85%, white 15%);
    color: white;
    padding: 0 14px;
    cursor: pointer;
    white-space: nowrap;
  }

  .modal-footer {
    padding: 12px 20px 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: flex-end;
    border-top: 1px solid var(--b1);
  }

  .modal-footer-error {
    margin-right: auto;
  }

  .modal-cancel {
    background: none;
    border: 1px solid var(--b2);
    color: var(--t4);
    padding: 8px 14px;
    cursor: pointer;
  }

  .modal-go {
    background: var(--accent);
    border: none;
    color: #fff;
    padding: 8px 18px;
    font-weight: 600;
    cursor: pointer;
  }
</style>
