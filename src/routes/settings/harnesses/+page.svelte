<script lang="ts">
  import { onMount } from "svelte";
  import SEO from "$lib/components/SEO.svelte";
  import type { AgentHarness } from "$lib/types/workspace";

  interface HarnessEditor {
    id: string;
    name: string;
    description: string;
    adapter: string;
    entryCommand: string;
    defaultModel: string;
    icon: string;
    enabled: boolean;
    configText: string;
  }

  function emptyEditor(): HarnessEditor {
    return {
      id: "",
      name: "",
      description: "",
      adapter: "",
      entryCommand: "",
      defaultModel: "",
      icon: "",
      enabled: true,
      configText: "{}",
    };
  }

  function toEditor(harness: AgentHarness): HarnessEditor {
    return {
      id: harness.id,
      name: harness.name,
      description: harness.description,
      adapter: harness.adapter,
      entryCommand: harness.entryCommand,
      defaultModel: harness.defaultModel,
      icon: harness.icon,
      enabled: harness.enabled,
      configText: JSON.stringify(harness.config, null, 2),
    };
  }

  let harnesses = $state<AgentHarness[]>([]);
  let isLoading = $state(true);
  let loadError = $state("");
  let submitError = $state("");
  let success = $state("");
  let isSaving = $state(false);
  let isDeleting = $state(false);
  let mode = $state<"create" | "edit">("edit");
  let selectedId = $state<string | null>(null);
  let editor = $state<HarnessEditor>(emptyEditor());

  async function loadHarnesses(nextSelectedId?: string | null) {
    isLoading = true;
    loadError = "";

    try {
      const response = await fetch("/api/harnesses");
      const data = await response.json().catch(() => ({})) as {
        harnesses?: AgentHarness[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Failed to load harnesses");
      }

      harnesses = data.harnesses ?? [];

      if (harnesses.length === 0) {
        mode = "create";
        selectedId = null;
        editor = emptyEditor();
        return;
      }

      const candidateId = nextSelectedId ?? selectedId ?? harnesses[0]?.id ?? null;
      const selected =
        (candidateId ? harnesses.find((harness) => harness.id === candidateId) : null) ??
        harnesses[0] ??
        null;

      if (!selected) {
        mode = "create";
        selectedId = null;
        editor = emptyEditor();
        return;
      }

      mode = "edit";
      selectedId = selected.id;
      editor = toEditor(selected);
    } catch (error) {
      loadError = error instanceof Error ? error.message : "Failed to load harnesses";
    } finally {
      isLoading = false;
    }
  }

  function selectHarness(harness: AgentHarness) {
    mode = "edit";
    selectedId = harness.id;
    editor = toEditor(harness);
    submitError = "";
    success = "";
  }

  function startCreate() {
    mode = "create";
    selectedId = null;
    editor = emptyEditor();
    submitError = "";
    success = "";
  }

  async function saveHarness() {
    submitError = "";
    success = "";

    let config: Record<string, unknown>;
    try {
      const parsed = JSON.parse(editor.configText || "{}") as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("Config must be a JSON object");
      }
      config = parsed as Record<string, unknown>;
    } catch (error) {
      submitError = error instanceof Error ? error.message : "Config must be valid JSON";
      return;
    }

    isSaving = true;

    const body = {
      id: editor.id.trim(),
      name: editor.name.trim(),
      description: editor.description.trim(),
      adapter: editor.adapter.trim(),
      entryCommand: editor.entryCommand.trim(),
      defaultModel: editor.defaultModel.trim(),
      icon: editor.icon.trim(),
      enabled: editor.enabled,
      config,
    };

    try {
      const response = await fetch(
        mode === "create" ? "/api/harnesses" : `/api/harnesses/${selectedId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      const payload = await response.json().catch(() => ({})) as {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message || "Failed to save harness");
      }

      await loadHarnesses(mode === "create" ? body.id : selectedId);
      success = mode === "create" ? "Harness created" : "Harness updated";
    } catch (error) {
      submitError = error instanceof Error ? error.message : "Failed to save harness";
    } finally {
      isSaving = false;
    }
  }

  async function deleteHarness() {
    if (mode !== "edit" || !selectedId) return;

    submitError = "";
    success = "";
    isDeleting = true;

    try {
      const response = await fetch(`/api/harnesses/${selectedId}`, {
        method: "DELETE",
      });

      const payload = await response.json().catch(() => ({})) as {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message || "Failed to delete harness");
      }

      const nextSelectedId = harnesses.find((harness) => harness.id !== selectedId)?.id ?? null;
      await loadHarnesses(nextSelectedId);
      success = "Harness deleted";
    } catch (error) {
      submitError = error instanceof Error ? error.message : "Failed to delete harness";
    } finally {
      isDeleting = false;
    }
  }

  onMount(async () => {
    await loadHarnesses();
  });
</script>

<SEO
  title="Harness registry | filepath"
  description="Manage the harness registry and defaults used by filepath agents."
  keywords="filepath harnesses, agent harness registry"
  path="/settings/harnesses"
  type="website"
  section="Settings"
  tags="settings,harnesses"
  noindex
  breadcrumbs={[
    { name: "Dashboard", item: "/dashboard" },
    { name: "Harness registry", item: "/settings/harnesses" },
  ]}
/>

<div class="min-h-screen bg-gray-50 text-gray-700 transition-colors duration-200 dark:bg-neutral-950 dark:text-neutral-300">
  <main class="mx-auto max-w-6xl px-6 py-12">
    <div class="mb-10 flex items-center justify-between">
      <div>
        <h1 class="mb-1 text-xl font-medium text-gray-900 dark:text-neutral-100">Harnesses</h1>
        <p class="text-sm text-gray-500 dark:text-neutral-500">
          Admin-only registry for the platform's spawnable harnesses.
        </p>
      </div>
      <a
        href="/settings/account"
        class="rounded border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:border-gray-400 dark:border-neutral-800 dark:text-neutral-400 dark:hover:border-neutral-600"
      >
        Back
      </a>
    </div>

    {#if loadError}
      <div class="mb-6 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300">
        {loadError}
      </div>
    {/if}

    {#if submitError}
      <div class="mb-6 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300">
        {submitError}
      </div>
    {/if}

    {#if success}
      <div class="mb-6 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300">
        {success}
      </div>
    {/if}

    <div class="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <section class="rounded border border-gray-200 bg-gray-100 p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-xs uppercase tracking-wide text-gray-500 dark:text-neutral-500">Registry</h2>
          <button
            onclick={startCreate}
            class="rounded border border-gray-300 px-2.5 py-1 text-xs text-gray-700 transition-colors hover:border-gray-400 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-500"
          >
            New
          </button>
        </div>

        {#if isLoading}
          <p class="text-sm text-gray-500 dark:text-neutral-500">Loading...</p>
        {:else if harnesses.length === 0}
          <p class="text-sm text-gray-500 dark:text-neutral-500">No harnesses yet.</p>
        {:else}
          <div class="space-y-2">
            {#each harnesses as harness (harness.id)}
              <button
                onclick={() => selectHarness(harness)}
                class="w-full rounded border px-3 py-2 text-left transition-colors
                  {selectedId === harness.id
                    ? 'border-gray-400 bg-white dark:border-neutral-600 dark:bg-neutral-950'
                    : 'border-gray-200 bg-white/60 hover:border-gray-300 dark:border-neutral-800 dark:bg-neutral-950/40 dark:hover:border-neutral-700'}"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="text-sm font-medium text-gray-900 dark:text-neutral-100">{harness.name}</span>
                  <span class="text-[10px] uppercase tracking-wide {harness.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-neutral-600'}">
                    {harness.enabled ? 'enabled' : 'disabled'}
                  </span>
                </div>
                <div class="mt-1 font-mono text-xs text-gray-500 dark:text-neutral-500">{harness.id}</div>
              </button>
            {/each}
          </div>
        {/if}
      </section>

      <section class="rounded border border-gray-200 bg-gray-100 p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div class="mb-5 flex items-center justify-between">
          <div>
            <h2 class="text-xs uppercase tracking-wide text-gray-500 dark:text-neutral-500">
              {mode === "create" ? "Create harness" : "Edit harness"}
            </h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-neutral-500">
              Harness IDs are what agent creation requests reference.
            </p>
          </div>
          {#if mode === "edit"}
            <button
              onclick={deleteHarness}
              disabled={isDeleting}
              class="rounded border border-red-300 px-3 py-1.5 text-xs text-red-600 transition-colors hover:border-red-400 disabled:opacity-50 dark:border-red-900/70 dark:text-red-300 dark:hover:border-red-800"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          {/if}
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <label class="block">
            <span class="mb-1 block text-xs uppercase tracking-wide text-gray-500 dark:text-neutral-500">ID</span>
            <input
              bind:value={editor.id}
              disabled={mode === "edit"}
              class="w-full rounded border border-gray-200 bg-white px-3 py-2 font-mono text-sm text-gray-800 disabled:cursor-not-allowed disabled:opacity-70 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
            />
          </label>

          <label class="block">
            <span class="mb-1 block text-xs uppercase tracking-wide text-gray-500 dark:text-neutral-500">Name</span>
            <input
              bind:value={editor.name}
              class="w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
            />
          </label>

          <label class="block">
            <span class="mb-1 block text-xs uppercase tracking-wide text-gray-500 dark:text-neutral-500">Adapter</span>
            <input
              bind:value={editor.adapter}
              class="w-full rounded border border-gray-200 bg-white px-3 py-2 font-mono text-sm text-gray-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
            />
          </label>

          <label class="block">
            <span class="mb-1 block text-xs uppercase tracking-wide text-gray-500 dark:text-neutral-500">Icon</span>
            <input
              bind:value={editor.icon}
              class="w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
            />
          </label>

          <label class="block md:col-span-2">
            <span class="mb-1 block text-xs uppercase tracking-wide text-gray-500 dark:text-neutral-500">Description</span>
            <textarea
              bind:value={editor.description}
              rows="3"
              class="w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
            ></textarea>
          </label>

          <label class="block">
            <span class="mb-1 block text-xs uppercase tracking-wide text-gray-500 dark:text-neutral-500">Default model</span>
            <input
              bind:value={editor.defaultModel}
              class="w-full rounded border border-gray-200 bg-white px-3 py-2 font-mono text-sm text-gray-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
            />
          </label>

          <label class="flex items-center gap-2 pt-6">
            <input bind:checked={editor.enabled} type="checkbox" />
            <span class="text-sm text-gray-700 dark:text-neutral-300">Enabled</span>
          </label>

          <label class="block md:col-span-2">
            <span class="mb-1 block text-xs uppercase tracking-wide text-gray-500 dark:text-neutral-500">Entry command</span>
            <textarea
              bind:value={editor.entryCommand}
              rows="3"
              class="w-full rounded border border-gray-200 bg-white px-3 py-2 font-mono text-sm text-gray-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
            ></textarea>
          </label>

          <label class="block md:col-span-2">
            <span class="mb-1 block text-xs uppercase tracking-wide text-gray-500 dark:text-neutral-500">Config JSON</span>
            <textarea
              bind:value={editor.configText}
              rows="8"
              class="w-full rounded border border-gray-200 bg-white px-3 py-2 font-mono text-sm text-gray-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
            ></textarea>
          </label>
        </div>

        <div class="mt-5 flex justify-end">
          <button
            onclick={saveHarness}
            disabled={isSaving}
            class="rounded border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800 transition-colors hover:border-gray-400 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-500"
          >
            {isSaving ? "Saving..." : mode === "create" ? "Create harness" : "Save changes"}
          </button>
        </div>
      </section>
    </div>
  </main>
</div>
