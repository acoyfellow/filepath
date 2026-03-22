<script lang="ts">
  import DicesIcon from "@lucide/svelte/icons/dices";
  import Button from "$lib/components/ui/button/button.svelte";
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
    canonicalizeStoredModel,
    getProviderForModel,
    type ProviderId,
  } from "$lib/provider-keys";
  import Combobox from "$lib/components/ui/combobox/combobox.svelte";
  import { onMount } from "svelte";
  import type { AgentHarness, HarnessId } from "$lib/types/workspace";

  interface ModelEntry {
    id: string;
    name: string;
    provider: string;
    router: ProviderId;
  }

  export interface AgentSettingsSubmitPayload {
    name?: string;
    harnessId: HarnessId;
    model: string;
    allowedPaths: string[];
    forbiddenPaths: string[];
    toolPermissions: ToolPermission[];
    writableRoot: string | null;
  }

  interface Props {
    mode: "create" | "edit";
    showNameField?: boolean;
    submitLabel: string;
    submitBusyLabel?: string;
    onsubmit: (payload: AgentSettingsSubmitPayload) => Promise<void> | void;
    oncancel?: () => void;
    onkeyschange?: (payload: {
      keys: Record<ProviderId, string | null>;
      error: string | null;
    }) => void;
    initialName?: string;
    initialHarnessId?: HarnessId;
    initialModel?: string;
    initialAllowedPaths?: string[];
    initialForbiddenPaths?: string[];
    initialToolPermissions?: ToolPermission[];
    initialWritableRoot?: string | null;
    accountKeysMasked?: Record<ProviderId, string | null>;
    accountKeysError?: string | null;
    topNotice?: {
      tone: "info" | "warning" | "success";
      title: string;
      message: string;
    } | null;
  }

  const EMPTY_KEYS: Record<ProviderId, string | null> = {
    openrouter: null,
    zen: null,
  };

  const NAME_POOL = ["atlas", "bolt", "cipher", "drift", "echo", "helix", "orbit", "relay", "trace", "vortex"];

  let {
    mode,
    showNameField = false,
    submitLabel,
    submitBusyLabel = "saving...",
    onsubmit,
    oncancel = () => {},
    onkeyschange = () => {},
    initialName = "",
    initialHarnessId = "shelley",
    initialModel = DEFAULT_MODEL,
    initialAllowedPaths = AGENT_SCOPE_PRESET.allowedPaths,
    initialForbiddenPaths = AGENT_SCOPE_PRESET.forbiddenPaths,
    initialToolPermissions = AGENT_SCOPE_PRESET.toolPermissions,
    initialWritableRoot = AGENT_SCOPE_PRESET.writableRoot ?? ".",
    accountKeysMasked = EMPTY_KEYS,
    accountKeysError = null,
    topNotice = null,
  }: Props = $props();

  function pickName(): string {
    return `${NAME_POOL[Math.floor(Math.random() * NAME_POOL.length)]}-${Math.floor(Math.random() * 99)}`;
  }

  function cloneMaskedKeys(source: Record<ProviderId, string | null>): Record<ProviderId, string | null> {
    return {
      openrouter: source.openrouter ?? null,
      zen: source.zen ?? null,
    };
  }

  const getInitialNameValue = () => initialName || (mode === "create" ? pickName() : "");
  const getInitialHarnessValue = () => initialHarnessId;
  const getInitialModelValue = () => initialModel;
  const getInitialAllowedPathsValue = () => initialAllowedPaths;
  const getInitialForbiddenPathsValue = () => initialForbiddenPaths;
  const getInitialWritableRootValue = () => initialWritableRoot;
  const getInitialToolPermissionsValue = () => initialToolPermissions;
  const getInitialAccountKeysValue = () => cloneMaskedKeys(accountKeysMasked);
  const getInitialAccountKeysErrorValue = () => accountKeysError ?? "";

  let name = $state(getInitialNameValue());
  let harnessId = $state<HarnessId>(getInitialHarnessValue());
  let model = $state(getInitialModelValue());
  let modelFilter = $state("");
  let harnessFilter = $state("");

  let allowedPathsInput = $state(getInitialAllowedPathsValue().join(", "));
  let forbiddenPathsInput = $state(getInitialForbiddenPathsValue().join(", "));
  let writableRootInput = $state(getInitialWritableRootValue() ?? ".");
  let selectedToolPermissions = $state<ToolPermission[]>([...getInitialToolPermissionsValue()]);

  let accountKeys = $state(getInitialAccountKeysValue());
  let accountKeysStateError = $state(getInitialAccountKeysErrorValue());
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
  let submitError = $state("");
  let submitting = $state(false);

  let hasAnyAccountKey = $derived(Object.values(accountKeys).some(Boolean));
  let selectedHarness = $derived(availableHarnesses.find((entry) => entry.id === harnessId) ?? null);
  let activeProvider = $derived.by<ProviderId>(() => {
    if (model) return getProviderForModel(model);
    if (accountKeys.zen) return "zen";
    return "openrouter";
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
  let modelOptions = $derived.by(() => {
    if (!model) return filteredModels;
    if (filteredModels.some((entry) => entry.id === model)) return filteredModels;
    return [
      {
        id: model,
        name: model,
        provider: PROVIDERS[getProviderForModel(model)].label,
        router: getProviderForModel(model),
      },
      ...filteredModels,
    ];
  });

  let filteredHarnesses = $derived(
    harnessFilter.trim()
      ? availableHarnesses.filter((entry) =>
          `${entry.id} ${entry.name} ${entry.description ?? ""}`
            .toLowerCase()
            .includes(harnessFilter.trim().toLowerCase()),
        )
      : availableHarnesses,
  );

  let runtimePolicy = $derived(
    normalizeAgentScope({
      allowedPaths: parseDelimitedInput(allowedPathsInput),
      forbiddenPaths: parseDelimitedInput(forbiddenPathsInput),
      toolPermissions: selectedToolPermissions,
      writableRoot: writableRootInput || null,
    }),
  );
  let selectedModelEntry = $derived(
    modelOptions.find((entry) => entry.id === model) ?? null,
  );

  let submitBlocker = $derived.by(() => {
    if (showNameField && !name.trim()) return "Name is required";
    if (harnessesLoading) return "Loading harnesses...";
    if (harnessesError) return harnessesError;
    if (!harnessId) return "Choose a harness";
    if (accountKeysStateError) return "Re-save your model provider key before continuing";
    if (!hasSelectedProviderKey) return `Add a ${activeProviderDefinition.label} key to continue`;
    if (modelsLoading) return "Loading live models...";
    if (modelsError) return modelsError;
    if (!model) return "Choose a model";
    if (runtimePolicy.allowedPaths.length === 0) return "Agent needs at least one allowed path";
    if (!runtimePolicy.writableRoot) return "Agent needs a writable root";
    if (!runtimePolicy.toolPermissions.includes("write")) return "Agent needs write permission";
    return null;
  });

  const labelClass =
    "mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-(--t5)";
  const inputClass =
    "w-full rounded-xl border border-(--b1) bg-(--bg2) px-4 py-3 text-sm text-(--t1) outline-none transition placeholder:text-(--t5) focus:border-(--accent) focus:ring-0";
  const cardClass =
    "rounded-xl border border-(--b1) px-3.5 py-3 text-xs leading-6";
  const metaClass = "text-[11px] leading-5 text-(--t5)";
  const bannerClass = (tone: "info" | "warning" | "success") =>
    tone === "warning"
      ? `${cardClass} border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300`
      : tone === "success"
        ? `${cardClass} border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300`
        : `${cardClass} bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] text-(--t2)`;

  const toolPermOrder = TOOL_PERMISSION_OPTIONS.map((o) => o.id);

  function toggleToolPermission(permission: ToolPermission) {
    if (selectedToolPermissions.includes(permission)) {
      selectedToolPermissions = selectedToolPermissions.filter((e) => e !== permission);
      return;
    }
    const next = [...selectedToolPermissions, permission];
    next.sort((a, b) => toolPermOrder.indexOf(a) - toolPermOrder.indexOf(b));
    selectedToolPermissions = next;
  }

  async function loadHarnesses() {
    harnessesLoading = true;
    harnessesError = "";
    try {
      const response = await fetch("/api/harnesses");
      const data = (await response.json().catch(() => ({}))) as { harnesses?: AgentHarness[]; error?: string };
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
      accountKeysStateError = "Unable to load saved model provider keys.";
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
      const data = (await response.json().catch(() => ({}))) as {
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
        : canonicalizeStoredModel(initialModel);

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
      const data = (await response.json().catch(() => ({}))) as {
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

  async function handleSubmit() {
    submitError = "";
    if (submitBlocker) {
      submitError = submitBlocker;
      return;
    }

    submitting = true;
    try {
      await Promise.resolve(
        onsubmit({
          name: showNameField ? name.trim() : undefined,
          harnessId,
          model,
          allowedPaths: runtimePolicy.allowedPaths,
          forbiddenPaths: runtimePolicy.forbiddenPaths,
          toolPermissions: runtimePolicy.toolPermissions,
          writableRoot: runtimePolicy.writableRoot,
        }),
      );
    } catch (error) {
      submitError = error instanceof Error ? error.message : "Failed to save agent";
    } finally {
      submitting = false;
    }
  }

  onMount(async () => {
    await loadAccountKeys();
    await loadHarnesses();
    // Explicit event-driven loading; avoids `$effect` while keeping the UI consistent.
    void loadModels();
  });
</script>

<div class="flex flex-col gap-3">
  {#if topNotice}
    <div class={bannerClass(topNotice.tone)}>
      <div class="mb-1 font-semibold">{topNotice.title}</div>
      <div>{topNotice.message}</div>
    </div>
  {/if}

  <!-- <div class={`${cardClass} bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] text-(--t2)`}>{setupSummary}</div> -->

  {#if showNameField}
    <label class={labelClass} for="agent-name-field">name</label>
    <div class="grid grid-cols-[1fr_auto] gap-2.5 max-[720px]:grid-cols-1">
      <input id="agent-name-field" bind:value={name} class={inputClass} />
      <Button
        variant="outline"
        size="icon"
        class="size-[46px] rounded-xl border-(--b1) bg-(--bg2) text-(--t3) shadow-none hover:border-(--t4) hover:bg-(--bg3) hover:text-(--t1)"
        onclick={() => { name = pickName(); }}
        aria-label="Generate name"
      >
        <DicesIcon size={14} />
      </Button>
    </div>
  {/if}

  <div class={labelClass}>harness</div>
  {#if harnessesError}
    <div class="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-xs leading-6 text-red-700 dark:text-red-300">{harnessesError}</div>
  {/if}
  <div class="relative rounded-xl border border-(--b1)">
    {#if harnessesLoading}
      <div class="px-4 py-3 text-xs text-(--t5)">Loading harnesses...</div>
    {:else}
      <Combobox
        value={harnessId}
        options={filteredHarnesses.map((entry) => ({
          value: entry.id,
          label: entry.name,
          description: entry.description,
        }))}
        searchValue={harnessFilter}
        onSearchValueChange={(next) => (harnessFilter = next)}
        placeholder="Choose a harness"
        disabled={Boolean(harnessesError) || availableHarnesses.length === 0}
        inputClass={inputClass}
        emptyText="No harnesses found"
        onValueChange={(next) => {
          harnessId = next as HarnessId;
          const harness = availableHarnesses.find((entry) => entry.id === next);
          if (!harness) return;
          const fallbackModel = canonicalizeStoredModel(harness.defaultModel);
          if (availableModels.some((entry) => entry.id === fallbackModel)) {
            model = fallbackModel;
          }
          modelFilter = "";
          void loadModels();
        }}
      />
    {/if}
  </div>


  {#if accountKeysStateError}
  <div class={labelClass}>model provider access</div>
    <div class="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-xs leading-6 text-red-700 dark:text-red-300">{accountKeysStateError}</div>
  {/if}
  {#if !hasSelectedProviderKey}
  
    <div class={cardClass}>
      <div class="mb-1 font-semibold text-(--t2)">Add {activeProviderDefinition.label} access inline</div>
      <div class="text-[11px] leading-5 text-(--t4)">
        filepath does not save agents into a known-bad missing-key state. Save the account key here and keep going.
      </div>
      <div class="mt-3 grid grid-cols-[1fr_auto] gap-2.5 max-[720px]:grid-cols-1">
        <input
          bind:value={inlineKeyDraft}
          class={inputClass}
          type="password"
          placeholder={`${activeProviderDefinition.label} key`}
          aria-label={`${activeProviderDefinition.label} key`}
        />
        <Button
          variant="outline"
          class="rounded-xl border-(--b1) bg-(--bg2) px-4 text-(--t2) shadow-none hover:border-(--t4) hover:bg-(--bg3) hover:text-(--t1)"
          onclick={saveInlineKey}
          disabled={inlineKeySaving || !inlineKeyDraft.trim()}
        >
          {inlineKeySaving ? "saving..." : "save key"}
        </Button>
      </div>
      {#if inlineKeyError}
        <div class="mt-2 text-[11px] leading-5 text-red-700 dark:text-red-300">{inlineKeyError}</div>
      {/if}
      {#if inlineKeySuccess}
        <div class="mt-2 text-[11px] leading-5 text-emerald-700 dark:text-emerald-300">{inlineKeySuccess}</div>
      {/if}
    </div>
  {/if}

  <div class={labelClass}>model</div>
  <Combobox
    value={model}
    options={modelOptions.map((entry) => ({
      value: entry.id,
      label: entry.name,
      description: entry.provider,
    }))}
    searchValue={modelFilter}
    onSearchValueChange={(next) => (modelFilter = next)}
    placeholder={modelsLoading ? "Loading live models..." : "Search live models..."}
    disabled={!hasSelectedProviderKey || modelsLoading || Boolean(modelsError)}
    inputClass={inputClass}
    emptyText={modelsLoading ? "Loading..." : "No models found"}
    onValueChange={(next) => {
      model = next;
      modelFilter = "";
    }}
  />
  {#if selectedModelEntry}
    <div class={metaClass}>Selected: {selectedModelEntry.name} via {selectedModelEntry.provider}</div>
  {/if}
  {#if modelsError}
    <div class="text-[11px] leading-5 text-red-700 dark:text-red-300">{modelsError}</div>
  {/if}
  {#if modelWarnings.length > 0}
    <div class={metaClass}>{modelWarnings.join(" ")}</div>
  {/if}

  <div class={labelClass}>allowed paths</div>
  <input bind:value={allowedPathsInput} class={inputClass} placeholder="src, docs, apps/web" aria-label="Allowed paths" />
  <div class={metaClass}>Comma or newline separated relative paths this agent can change.</div>

  <div class={labelClass}>forbidden paths</div>
  <input bind:value={forbiddenPathsInput} class={inputClass} placeholder=".git, node_modules, secrets" aria-label="Forbidden paths" />
  <div class={metaClass}>Optional guardrails inside the allowed area.</div>

  <div class={labelClass}>writable root</div>
  <input bind:value={writableRootInput} class={inputClass} placeholder="src" aria-label="Writable root" />
  <div class={metaClass}>Commands run from here. Keep it inside the allowed paths.</div>

  <div class={labelClass}>tool permissions</div>
  <div class="flex flex-col gap-2">
    {#each TOOL_PERMISSION_OPTIONS as option}
      <label class="flex cursor-pointer gap-3 rounded-xl border border-(--b1) bg-(--bg2) px-4 py-3 text-sm text-(--t2) transition hover:border-(--b2) has-focus-visible:border-(--accent)">
        <input
          type="checkbox"
          class="mt-1 h-4 w-4 shrink-0 rounded border-(--b1) accent-(--accent)"
          checked={selectedToolPermissions.includes(option.id)}
          onchange={() => toggleToolPermission(option.id)}
        />
        <span class="min-w-0">
          <span class="block font-medium text-(--t1)">{option.label}</span>
          <span class="mt-0.5 block text-[11px] leading-5 text-(--t5)">{option.description}</span>
        </span>
      </label>
    {/each}
  </div>

  {#if submitError}
    <div class="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-xs leading-6 text-red-700 dark:text-red-300">{submitError}</div>
  {/if}

  <div class="mt-1 flex justify-end gap-3 max-[720px]:sticky max-[720px]:bottom-0 max-[720px]:bg-[linear-gradient(to_top,var(--bg)_75%,transparent)] max-[720px]:pt-3">
    <Button variant="outline" type="button" class="rounded-xl" onclick={oncancel}>cancel</Button>
    <Button
      variant="accent"
      type="button"
      disabled={Boolean(submitBlocker) || submitting}
      onclick={handleSubmit}
    >
      {submitting ? submitBusyLabel : submitLabel}
    </Button>
  </div>
</div>
