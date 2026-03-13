<script lang="ts">
  import { DEFAULT_MODEL } from "$lib/config";
  import {
    AGENT_SCOPE_PRESET,
    TOOL_PERMISSION_OPTIONS,
    normalizeAgentScope,
    parseDelimitedInput,
    type ToolPermission,
  } from "$lib/runtime/authority";
  import {
    PROVIDERS,
    PROVIDER_IDS,
    canonicalizeStoredModel,
    getProviderForModel,
    type ProviderId,
  } from "$lib/provider-keys";
  import { onMount } from "svelte";
  import type { AgentCreateRequest, AgentHarness, HarnessId } from "$lib/types/workspace";

  interface ModelEntry {
    id: string;
    name: string;
    provider: string;
    router: ProviderId;
  }

  interface Props {
    onclose: () => void;
    onspawn: (req: AgentCreateRequest) => Promise<void> | void;
    onkeyschange?: (payload: {
      keys: Record<ProviderId, string | null>;
      error: string | null;
    }) => void;
    lastAgent?: HarnessId;
    lastModel?: string;
    accountKeysMasked?: Record<ProviderId, string | null>;
    accountKeysError?: string | null;
  }

  const EMPTY_KEYS: Record<ProviderId, string | null> = {
    openrouter: null,
    zen: null,
  };

  const NAME_POOL = ["atlas", "bolt", "cipher", "drift", "echo", "helix", "orbit", "relay", "trace", "vortex"];

  let {
    onclose,
    onspawn,
    onkeyschange = () => {},
    lastAgent = "shelley",
    lastModel = DEFAULT_MODEL,
    accountKeysMasked = EMPTY_KEYS,
    accountKeysError = null,
  }: Props = $props();

  function getInitialHarnessId() {
    return lastAgent;
  }

  function getInitialAccountKeys() {
    return cloneMaskedKeys(accountKeysMasked);
  }

  function getInitialAccountKeysError() {
    return accountKeysError ?? "";
  }

  function pickName(): string {
    return `${NAME_POOL[Math.floor(Math.random() * NAME_POOL.length)]}-${Math.floor(Math.random() * 99)}`;
  }

  function cloneMaskedKeys(source: Record<ProviderId, string | null>): Record<ProviderId, string | null> {
    return {
      openrouter: source.openrouter ?? null,
      zen: source.zen ?? null,
    };
  }

  let name = $state(pickName());
  let harnessId = $state<HarnessId>(getInitialHarnessId());
  let model = $state("");
  let modelFilter = $state("");

  let allowedPathsInput = $state(AGENT_SCOPE_PRESET.allowedPaths.join(", "));
  let forbiddenPathsInput = $state(AGENT_SCOPE_PRESET.forbiddenPaths.join(", "));
  let writableRootInput = $state(AGENT_SCOPE_PRESET.writableRoot ?? ".");
  let selectedToolPermissions = $state<ToolPermission[]>([...AGENT_SCOPE_PRESET.toolPermissions]);

  let accountKeys = $state(getInitialAccountKeys());
  let accountKeysStateError = $state(getInitialAccountKeysError());
  let availableModels = $state<ModelEntry[]>([]);
  let availableHarnesses = $state<AgentHarness[]>([]);

  let harnessesLoading = $state(true);
  let harnessesError = $state("");
  let modelsLoading = $state(false);
  let modelsError = $state("");
  let modelWarnings = $state<string[]>([]);
  let inlineKeyDraft = $state("");
  let inlineKeySaving = $state(false);
  let inlineKeyError = $state("");
  let inlineKeySuccess = $state("");
  let spawnError = $state("");
  let spawning = $state(false);

  let hasAnyAccountKey = $derived(Object.values(accountKeys).some(Boolean));
  let selectedHarness = $derived(availableHarnesses.find((entry) => entry.id === harnessId) ?? null);
  let activeProvider = $derived.by<ProviderId>(() => {
    if (model) return getProviderForModel(model);
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

  let runtimePolicy = $derived(
    normalizeAgentScope({
      allowedPaths: parseDelimitedInput(allowedPathsInput),
      forbiddenPaths: parseDelimitedInput(forbiddenPathsInput),
      toolPermissions: selectedToolPermissions,
      writableRoot: writableRootInput || null,
    }),
  );

  let selectedModelEntry = $derived(availableModels.find((entry) => entry.id === model) ?? null);

  let setupSummary = $derived.by(() => {
    if (accountKeysStateError) {
      return "Re-save your router key to unlock live models and agent execution.";
    }
    if (!hasSelectedProviderKey) {
      return `Save a ${activeProviderDefinition.label} key, then choose a model and agent scope.`;
    }
    if (!model) {
      return "Choose a model, then confirm the agent scope before creating it.";
    }
    return "This agent will run with explicit path and tool boundaries.";
  });

  let spawnBlocker = $derived.by(() => {
    if (!name.trim()) return "Name is required";
    if (harnessesLoading) return "Loading harnesses...";
    if (harnessesError) return harnessesError;
    if (!harnessId) return "Choose a harness";
    if (accountKeysStateError) return "Re-save your router key before spawning";
    if (!hasSelectedProviderKey) return `Add a ${activeProviderDefinition.label} key to continue`;
    if (modelsLoading) return "Loading live models...";
    if (modelsError) return modelsError;
    if (!model) return "Choose a model";
    if (runtimePolicy.allowedPaths.length === 0) return "Agent needs at least one allowed path";
    if (!runtimePolicy.writableRoot) return "Agent needs a writable root";
    if (!runtimePolicy.toolPermissions.includes("write")) return "Agent needs write permission";
    return null;
  });

  function toggleToolPermission(permission: ToolPermission) {
    if (selectedToolPermissions.includes(permission)) {
      selectedToolPermissions = selectedToolPermissions.filter((entry) => entry !== permission);
      return;
    }

    selectedToolPermissions = [...selectedToolPermissions, permission];
  }

  async function loadHarnesses() {
    harnessesLoading = true;
    harnessesError = "";
    try {
      const response = await fetch("/api/harnesses");
      const data = await response.json().catch(() => ({})) as { harnesses?: AgentHarness[]; error?: string };
      if (!response.ok) {
        harnessesError = data.error ?? "Harness catalog unavailable";
        availableHarnesses = [];
        return;
      }

      availableHarnesses = (data.harnesses ?? []).filter((entry) => entry.enabled);
      if (!availableHarnesses.some((entry) => entry.id === harnessId) && availableHarnesses[0]) {
        harnessId = availableHarnesses[0].id;
      }
    } catch {
      harnessesError = "Harness catalog unavailable";
      availableHarnesses = [];
    } finally {
      harnessesLoading = false;
    }
  }

  async function loadAccountKeys() {
    inlineKeyError = "";
    inlineKeySuccess = "";

    try {
      const response = await fetch("/api/user/keys");
      const data = (await response.json().catch(() => ({}))) as {
        keys?: Record<ProviderId, string | null>;
        error?: string;
        message?: string;
      };

      accountKeys = cloneMaskedKeys(data.keys ?? EMPTY_KEYS);
      accountKeysStateError = data.error ?? data.message ?? "";
      onkeyschange({
        keys: cloneMaskedKeys(accountKeys),
        error: accountKeysStateError || null,
      });
    } catch {
      accountKeys = cloneMaskedKeys(EMPTY_KEYS);
      accountKeysStateError = "Unable to load saved router keys.";
      onkeyschange({
        keys: cloneMaskedKeys(EMPTY_KEYS),
        error: accountKeysStateError,
      });
    }
  }

  async function loadModels() {
    if (!hasAnyAccountKey) {
      availableModels = [];
      model = "";
      modelsError = "";
      modelsLoading = false;
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

      const nextModels = Array.from(new Map((data.models ?? []).map((entry) => [entry.id, entry])).values());
      availableModels = nextModels;

      if (model && nextModels.some((entry) => entry.id === model)) return;

      const harnessDefault = selectedHarness?.defaultModel
        ? canonicalizeStoredModel(selectedHarness.defaultModel)
        : canonicalizeStoredModel(lastModel);

      model = nextModels.some((entry) => entry.id === harnessDefault) ? harnessDefault : "";
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
      onkeyschange({
        keys: cloneMaskedKeys(accountKeys),
        error: null,
      });
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
        harnessId,
        model,
        allowedPaths: runtimePolicy.allowedPaths,
        forbiddenPaths: runtimePolicy.forbiddenPaths,
        toolPermissions: runtimePolicy.toolPermissions,
        writableRoot: runtimePolicy.writableRoot,
      }));
    } catch (error) {
      spawnError = error instanceof Error ? error.message : "Failed to create agent";
    } finally {
      spawning = false;
    }
  }

  onMount(async () => {
    await loadAccountKeys();
    await loadHarnesses();
  });

  $effect(() => {
    harnessId;
    accountKeys.openrouter;
    accountKeys.zen;
    void loadModels();
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-bg" onclick={(event) => event.target === event.currentTarget && onclose()}>
  <div
    class="modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="spawn-agent-title"
    tabindex="-1"
    onclick={(event) => event.stopPropagation()}
    onkeydown={(event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onclose();
      }
    }}
  >
    <div class="modal-title" id="spawn-agent-title">new agent</div>
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

      <div class="modal-label">harness</div>
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
              class:on={harnessId === harness.id}
              onclick={() => {
                harnessId = harness.id;
                const fallbackModel = canonicalizeStoredModel(harness.defaultModel);
                if (availableModels.some((entry) => entry.id === fallbackModel)) {
                  model = fallbackModel;
                }
              }}
            >
              {harness.name}
            </button>
          {/each}
        {/if}
      </div>
      {#if selectedHarness}
        <div class="modal-meta">{selectedHarness.description}</div>
      {/if}

      <div class="modal-label">router access</div>
      {#if accountKeysStateError}
        <div class="modal-banner modal-banner-error">{accountKeysStateError}</div>
      {/if}
      {#if hasSelectedProviderKey}
        <div class="modal-key-card modal-key-card-ready">
          <div class="modal-key-title">Model access is ready</div>
          <div class="modal-key-copy">Using saved {activeProviderDefinition.label} access for this agent.</div>
        </div>
      {:else}
        <div class="modal-key-card">
          <div class="modal-key-title">Add {activeProviderDefinition.label} access inline</div>
          <div class="modal-key-copy">
            filepath does not create agents into a known-bad missing-key state. Save the account key here and keep going.
          </div>
          <div class="modal-inline-key">
            <input
              bind:value={inlineKeyDraft}
              class="modal-input"
              type="password"
              placeholder={`${activeProviderDefinition.label} key`}
            />
            <button class="modal-inline-save" onclick={saveInlineKey} disabled={inlineKeySaving || !inlineKeyDraft.trim()}>
              {inlineKeySaving ? "saving..." : "save key"}
            </button>
          </div>
          {#if inlineKeyError}
            <div class="modal-meta modal-meta-error">{inlineKeyError}</div>
          {/if}
          {#if inlineKeySuccess}
            <div class="modal-meta modal-meta-success">{inlineKeySuccess}</div>
          {/if}
        </div>
      {/if}

      <div class="modal-label">model</div>
      <input bind:value={modelFilter} class="modal-input" placeholder="Search live models..." />
      <div class="modal-select-shell">
        <select bind:value={model} class="modal-select" disabled={!hasSelectedProviderKey || modelsLoading || Boolean(modelsError)}>
          <option value="">{modelsLoading ? "Loading live models..." : "Choose a model"}</option>
          {#each filteredModels as entry}
            <option value={entry.id}>{entry.id}</option>
          {/each}
        </select>
      </div>
      {#if selectedModelEntry}
        <div class="modal-meta">Selected: {selectedModelEntry.name} via {selectedModelEntry.provider}</div>
      {/if}
      {#if modelsError}
        <div class="modal-meta modal-meta-error">{modelsError}</div>
      {/if}
      {#if modelWarnings.length > 0}
        <div class="modal-meta">{modelWarnings.join(" ")}</div>
      {/if}

      <div class="modal-label">allowed paths</div>
      <input bind:value={allowedPathsInput} class="modal-input" placeholder="src, docs, apps/web" />
      <div class="modal-meta">Comma or newline separated relative paths this agent can change.</div>

      <div class="modal-label">forbidden paths</div>
      <input bind:value={forbiddenPathsInput} class="modal-input" placeholder=".git, node_modules, secrets" />
      <div class="modal-meta">Optional guardrails inside the allowed area.</div>

      <div class="modal-label">writable root</div>
      <input bind:value={writableRootInput} class="modal-input" placeholder="src" />
      <div class="modal-meta">Commands run from here. Keep it inside the allowed paths.</div>

      <div class="modal-label">tool permissions</div>
      <div class="tool-grid">
        {#each TOOL_PERMISSION_OPTIONS as option}
          <button
            class="tool-chip"
            class:on={selectedToolPermissions.includes(option.id)}
            onclick={() => toggleToolPermission(option.id)}
          >
            <span>{option.label}</span>
            <small>{option.description}</small>
          </button>
        {/each}
      </div>

      <div class="modal-policy-preview">
        <div><strong>agent</strong> scope</div>
        <div>Allowed: {runtimePolicy.allowedPaths.join(", ")}</div>
        <div>Forbidden: {runtimePolicy.forbiddenPaths.length > 0 ? runtimePolicy.forbiddenPaths.join(", ") : "none"}</div>
        <div>Tools: {runtimePolicy.toolPermissions.join(", ")}</div>
        <div>Writable root: {runtimePolicy.writableRoot ?? "read-only"}</div>
      </div>

      {#if spawnError}
        <div class="modal-banner modal-banner-error">{spawnError}</div>
      {/if}
    </div>

    <div class="modal-actions">
      <button class="modal-btn modal-btn-secondary" onclick={onclose}>cancel</button>
      <button class="modal-btn modal-btn-primary" disabled={Boolean(spawnBlocker) || spawning} onclick={handleSpawn}>
        {spawning ? "creating..." : "create agent"}
      </button>
    </div>
  </div>
</div>

<style>
  .modal-bg {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, black 30%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 80;
  }
  .modal {
    width: min(760px, calc(100vw - 24px));
    max-height: calc(100vh - 24px);
    overflow: auto;
    background: var(--bg);
    border: 1px solid var(--b1);
    border-radius: 16px;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.2);
  }
  .modal-title {
    font-family: var(--m);
    font-size: 20px;
    font-weight: 700;
    padding: 20px 24px 0;
  }
  .modal-body {
    padding: 18px 24px 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .modal-label {
    font-family: var(--m);
    text-transform: uppercase;
    font-size: 11px;
    color: var(--t5);
    letter-spacing: 0.16em;
    margin-top: 4px;
  }
  .modal-input,
  .modal-select {
    width: 100%;
    border: 1px solid var(--b1);
    border-radius: 12px;
    background: var(--bg2);
    color: var(--t1);
    padding: 14px 16px;
    font-family: var(--m);
    font-size: 14px;
  }
  .modal-select-shell {
    border: 1px solid var(--b1);
    border-radius: 12px;
    overflow: hidden;
  }
  .modal-select {
    border: 0;
    border-radius: 0;
    appearance: none;
  }
  .modal-name-row,
  .modal-inline-key {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 10px;
  }
  .modal-dice,
  .modal-inline-save {
    border: 1px solid var(--b1);
    border-radius: 12px;
    background: var(--bg2);
    color: var(--t2);
    font-family: var(--m);
    padding: 0 14px;
    cursor: pointer;
  }
  .modal-banner,
  .modal-key-card,
  .modal-policy-preview {
    border: 1px solid var(--b1);
    border-radius: 12px;
    padding: 12px 14px;
    font-family: var(--m);
    font-size: 12px;
    line-height: 1.5;
  }
  .modal-banner-setup {
    background: color-mix(in srgb, var(--accent) 8%, transparent);
    color: var(--t2);
  }
  .modal-banner-error {
    background: color-mix(in srgb, #ef4444 10%, transparent);
    color: #b91c1c;
  }
  .modal-key-card-ready {
    background: color-mix(in srgb, #10b981 10%, transparent);
  }
  .modal-key-title {
    font-weight: 600;
    margin-bottom: 4px;
  }
  .modal-key-copy,
  .modal-meta {
    font-family: var(--m);
    font-size: 11px;
    color: var(--t5);
    line-height: 1.5;
  }
  .modal-meta-error {
    color: #b91c1c;
  }
  .modal-meta-success {
    color: #047857;
  }
  .tool-grid,
  .modal-options {
    display: grid;
    gap: 10px;
  }
  .tool-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .modal-options-harness {
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  }
  .tool-chip,
  .modal-option {
    border: 1px solid var(--b1);
    border-radius: 12px;
    background: var(--bg2);
    color: var(--t2);
    font-family: var(--m);
    padding: 12px;
    text-align: left;
    cursor: pointer;
  }
  .tool-chip.on,
  .modal-option.on {
    border-color: color-mix(in srgb, var(--accent) 65%, var(--b1));
    background: color-mix(in srgb, var(--accent) 10%, var(--bg2));
    color: var(--t1);
  }
  .tool-chip small {
    display: block;
    color: var(--t5);
    font-size: 10px;
    line-height: 1.4;
    margin-top: 4px;
  }
  .modal-placeholder {
    padding: 12px;
    border: 1px dashed var(--b1);
    border-radius: 12px;
    color: var(--t5);
    font-family: var(--m);
    font-size: 12px;
  }
  .modal-policy-preview {
    background: var(--bg2);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .modal-actions {
    padding: 16px 24px 24px;
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    border-top: 1px solid var(--b1);
  }
  .modal-btn {
    border-radius: 12px;
    padding: 12px 16px;
    border: 1px solid var(--b1);
    font-family: var(--m);
    cursor: pointer;
  }
  .modal-btn-primary {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }
  .modal-btn-secondary {
    background: var(--bg2);
    color: var(--t2);
  }
  .modal-btn:disabled,
  .tool-chip:disabled,
  .modal-inline-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  @media (max-width: 720px) {
    .tool-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
