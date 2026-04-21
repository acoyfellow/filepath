<script lang="ts">
  import Button from "$lib/components/ui/button/button.svelte";
  import {
    AGENT_SCOPE_PRESET,
    TOOL_PERMISSION_OPTIONS,
    normalizeAgentScope,
    parseDelimitedInput,
    type ToolPermission,
  } from "$lib/runtime/authority";
  import Combobox from "$lib/components/ui/combobox/combobox.svelte";
  import { onMount } from "svelte";
  import type { AgentHarness, HarnessId } from "$lib/types/workspace";
  import type { AiConnectionPublic } from "$lib/ai-connections";

  export interface AgentSettingsSubmitPayload {
    name?: string;
    harnessId: HarnessId;
    aiConnectionId: string;
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
    initialName?: string;
    initialHarnessId?: HarnessId;
    initialAiConnectionId?: string;
    initialAllowedPaths?: string[];
    initialForbiddenPaths?: string[];
    initialToolPermissions?: ToolPermission[];
    initialWritableRoot?: string | null;
    /** List of user's configured AI connections (public shape; no keys). */
    aiConnections: AiConnectionPublic[];
    topNotice?: {
      tone: "info" | "warning" | "success";
      title: string;
      message: string;
    } | null;
  }

  const NAME_POOL = ["atlas", "bolt", "cipher", "drift", "echo", "helix", "orbit", "relay", "trace", "vortex"];

  let {
    mode,
    showNameField = false,
    submitLabel,
    submitBusyLabel = "saving...",
    onsubmit,
    oncancel = () => {},
    initialName = "",
    initialHarnessId = "shelley",
    initialAiConnectionId = "",
    initialAllowedPaths = AGENT_SCOPE_PRESET.allowedPaths,
    initialForbiddenPaths = AGENT_SCOPE_PRESET.forbiddenPaths,
    initialToolPermissions = AGENT_SCOPE_PRESET.toolPermissions,
    initialWritableRoot = AGENT_SCOPE_PRESET.writableRoot ?? ".",
    aiConnections,
    topNotice = null,
  }: Props = $props();

  function pickName(): string {
    return `${NAME_POOL[Math.floor(Math.random() * NAME_POOL.length)]}-${Math.floor(Math.random() * 99)}`;
  }

  function defaultConnectionId(): string {
    if (initialAiConnectionId && aiConnections.some((c) => c.id === initialAiConnectionId)) {
      return initialAiConnectionId;
    }
    const userDefault = aiConnections.find((c) => c.isDefault);
    return userDefault?.id ?? aiConnections[0]?.id ?? "";
  }

  let name = $state(initialName || (mode === "create" ? pickName() : ""));
  let harnessId = $state<HarnessId>(initialHarnessId);
  let aiConnectionId = $state<string>(defaultConnectionId());
  let harnessFilter = $state("");

  let allowedPathsInput = $state(initialAllowedPaths.join(", "));
  let forbiddenPathsInput = $state(initialForbiddenPaths.join(", "));
  let writableRootInput = $state(initialWritableRoot ?? ".");
  let selectedToolPermissions = $state<ToolPermission[]>([...initialToolPermissions]);

  let availableHarnesses = $state<AgentHarness[]>([]);
  let harnessesLoading = $state(true);
  let harnessesError = $state("");
  let submitError = $state("");
  let submitting = $state(false);

  let selectedConnection = $derived(aiConnections.find((c) => c.id === aiConnectionId) ?? null);
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

  let submitBlocker = $derived.by(() => {
    if (showNameField && !name.trim()) return "Name is required";
    if (harnessesLoading) return "Loading harnesses...";
    if (harnessesError) return harnessesError;
    if (!harnessId) return "Choose a harness";
    if (aiConnections.length === 0) return "Add an AI connection in Settings → AI";
    if (!aiConnectionId) return "Choose an AI connection";
    if (runtimePolicy.allowedPaths.length === 0) return "Agent needs at least one allowed path";
    if (!runtimePolicy.writableRoot) return "Agent needs a writable root";
    if (!runtimePolicy.toolPermissions.includes("write")) return "Agent needs write permission";
    return null;
  });

  const labelClass = "mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-(--t5)";
  const inputClass =
    "w-full rounded-xl border border-(--b1) bg-(--bg2) px-4 py-3 text-sm text-(--t1) outline-none transition placeholder:text-(--t5) focus:border-(--accent) focus:ring-0";
  const cardClass = "rounded-xl border border-(--b1) px-3.5 py-3 text-xs leading-6";
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
      const data = (await response.json().catch(() => ({}))) as {
        harnesses?: AgentHarness[];
        error?: string;
      };
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

  async function handleSubmit() {
    submitError = "";
    if (submitBlocker) {
      submitError = submitBlocker;
      return;
    }
    submitting = true;
    try {
      const payload: AgentSettingsSubmitPayload = {
        harnessId,
        aiConnectionId,
        allowedPaths: runtimePolicy.allowedPaths,
        forbiddenPaths: runtimePolicy.forbiddenPaths,
        toolPermissions: runtimePolicy.toolPermissions,
        writableRoot: runtimePolicy.writableRoot,
      };
      if (showNameField) payload.name = name.trim();
      await onsubmit(payload);
    } catch (err) {
      submitError = err instanceof Error ? err.message : "Failed to submit";
    } finally {
      submitting = false;
    }
  }

  onMount(() => {
    void loadHarnesses();
  });
</script>

<div class="flex flex-col gap-4">
  {#if topNotice}
    <div class={bannerClass(topNotice.tone)}>
      <div class="font-semibold text-(--t1)">{topNotice.title}</div>
      <div class="mt-1 text-(--t3)">{topNotice.message}</div>
    </div>
  {/if}

  {#if showNameField}
    <div class={labelClass}>name</div>
    <div class="flex items-center gap-2">
      <input
        bind:value={name}
        class={inputClass}
        placeholder="agent name"
        aria-label="Agent name"
      />
      <button
        type="button"
        class="shrink-0 rounded-xl border border-(--b1) bg-(--bg2) px-3 py-3 text-xs text-(--t3) hover:border-(--t4) hover:text-(--t1)"
        onclick={() => (name = pickName())}
        aria-label="Random name"
      >
        🎲
      </button>
    </div>
  {/if}

  <div class={labelClass}>harness</div>
  <div>
    {#if harnessesError}
      <div class="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-xs leading-6 text-red-700 dark:text-red-300">
        {harnessesError}
      </div>
    {:else if availableHarnesses.length === 0 && !harnessesLoading}
      <div class={cardClass}>No harnesses available.</div>
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
          harnessFilter = "";
        }}
      />
    {/if}
  </div>

  <div class={labelClass}>AI connection</div>
  {#if aiConnections.length === 0}
    <div class={cardClass}>
      <div class="mb-1 font-semibold text-(--t2)">No AI connections yet</div>
      <div class={metaClass}>
        Add one in <a class="underline hover:text-(--t1)" href="/settings/ai">Settings → AI</a> before creating an agent.
      </div>
    </div>
  {:else}
    <select
      bind:value={aiConnectionId}
      class={inputClass}
      aria-label="AI connection"
    >
      {#each aiConnections as conn (conn.id)}
        <option value={conn.id}>
          {conn.displayName} — {conn.model} ({conn.provider}){conn.isDefault ? " ✓" : ""}
        </option>
      {/each}
    </select>
    {#if selectedConnection}
      <div class={metaClass}>
        {selectedConnection.endpoint}
        {#if selectedConnection.tags.length > 0}
          · tags: {selectedConnection.tags.join(", ")}
        {/if}
      </div>
    {/if}
    <div class={metaClass}>
      <a class="underline hover:text-(--t1)" href="/settings/ai">Manage connections →</a>
    </div>
  {/if}

  <div class={labelClass}>allowed paths</div>
  <input
    bind:value={allowedPathsInput}
    class={inputClass}
    placeholder="src, docs, apps/web"
    aria-label="Allowed paths"
  />
  <div class={metaClass}>Comma or newline separated relative paths this agent can change.</div>

  <div class={labelClass}>forbidden paths</div>
  <input
    bind:value={forbiddenPathsInput}
    class={inputClass}
    placeholder=".git, node_modules, secrets"
    aria-label="Forbidden paths"
  />
  <div class={metaClass}>Optional guardrails inside the allowed area.</div>

  <div class={labelClass}>writable root</div>
  <input
    bind:value={writableRootInput}
    class={inputClass}
    placeholder="src"
    aria-label="Writable root"
  />
  <div class={metaClass}>Commands run from here. Keep it inside the allowed paths.</div>

  <div class={labelClass}>tool permissions</div>
  <div class="flex flex-col gap-2">
    {#each TOOL_PERMISSION_OPTIONS as option (option.id)}
      <label
        class="flex cursor-pointer gap-3 rounded-xl border border-(--b1) bg-(--bg2) px-4 py-3 text-sm text-(--t2) transition hover:border-(--b2) has-focus-visible:border-(--accent)"
      >
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
    <div class="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-xs leading-6 text-red-700 dark:text-red-300">
      {submitError}
    </div>
  {/if}

  <div
    class="mt-1 flex justify-end gap-3 max-[720px]:sticky max-[720px]:bottom-0 max-[720px]:bg-[linear-gradient(to_top,var(--bg)_75%,transparent)] max-[720px]:pt-3"
  >
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
