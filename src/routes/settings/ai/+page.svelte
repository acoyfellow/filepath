<script lang="ts">
  import SEO from "$lib/components/SEO.svelte";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import CheckIcon from "@lucide/svelte/icons/check";
  import XIcon from "@lucide/svelte/icons/x";
  import Button from "$lib/components/ui/button/button.svelte";
  import type { PageData } from "./$types";
  import type { AiConnectionPublic, ProviderFormat } from "$lib/ai-connections";

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  const PROVIDER_LABEL: Record<ProviderFormat, string> = {
    anthropic: "Anthropic",
    "openai-chat": "OpenAI (Chat API)",
    "openai-responses": "OpenAI (Responses API)",
    gemini: "Google Gemini",
  };

  const DEFAULT_ENDPOINT: Record<ProviderFormat, string> = {
    anthropic: "https://api.anthropic.com/v1/messages",
    "openai-chat": "https://api.openai.com/v1/chat/completions",
    "openai-responses": "https://api.openai.com/v1/responses",
    gemini: "https://generativelanguage.googleapis.com/v1beta/models",
  };

  // Preset model pills per provider (starting point for the user)
  const MODEL_PRESETS: Record<ProviderFormat, Array<{ id: string; label: string }>> = {
    anthropic: [
      { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
    ],
    "openai-chat": [
      { id: "gpt-5", label: "GPT-5" },
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o mini" },
    ],
    "openai-responses": [
      { id: "gpt-5", label: "GPT-5" },
      { id: "o3", label: "o3" },
      { id: "o3-mini", label: "o3-mini" },
    ],
    gemini: [
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    ],
  };

  let connections = $state<AiConnectionPublic[]>(data.connections);
  let error = $state<string | null>(null);

  // Editor state — null = closed, else holds form values
  interface EditorState {
    id: string | null; // null = create mode, string = edit mode
    provider: ProviderFormat;
    endpointMode: "default" | "custom";
    endpointCustom: string;
    model: string;
    displayName: string;
    apiKey: string;
    apiKeyIsExisting: boolean; // true when editing — key already stored, user may leave blank
    maxContextTokens: number;
    tagsInput: string;
    saving: boolean;
    testing: boolean;
    testResult: { ok: boolean; error?: string; preview?: string; durationMs: number } | null;
    error: string | null;
  }

  let editor = $state<EditorState | null>(null);

  function newEditor(): EditorState {
    return {
      id: null,
      provider: "anthropic",
      endpointMode: "default",
      endpointCustom: "",
      model: "",
      displayName: "",
      apiKey: "",
      apiKeyIsExisting: false,
      maxContextTokens: 200_000,
      tagsInput: "",
      saving: false,
      testing: false,
      testResult: null,
      error: null,
    };
  }

  function editorFrom(conn: AiConnectionPublic): EditorState {
    const defaultEndpoint = DEFAULT_ENDPOINT[conn.provider];
    return {
      id: conn.id,
      provider: conn.provider,
      endpointMode: conn.endpoint === defaultEndpoint ? "default" : "custom",
      endpointCustom: conn.endpoint === defaultEndpoint ? "" : conn.endpoint,
      model: conn.model,
      displayName: conn.displayName,
      apiKey: "",
      apiKeyIsExisting: true,
      maxContextTokens: conn.maxContextTokens,
      tagsInput: conn.tags.join(", "),
      saving: false,
      testing: false,
      testResult: null,
      error: null,
    };
  }

  async function refresh() {
    try {
      const res = await fetch("/api/ai");
      const body = (await res.json().catch(() => ({}))) as { connections?: AiConnectionPublic[] };
      connections = body.connections ?? [];
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to refresh";
    }
  }

  function openCreate() {
    editor = newEditor();
  }

  function openEdit(conn: AiConnectionPublic) {
    editor = editorFrom(conn);
  }

  function cancelEditor() {
    editor = null;
  }

  function resolvedEndpoint(e: EditorState): string {
    return e.endpointMode === "custom" ? e.endpointCustom.trim() : DEFAULT_ENDPOINT[e.provider];
  }

  function parseTags(input: string): string[] {
    return input
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  async function saveEditor() {
    if (!editor) return;
    editor.error = null;
    if (!editor.displayName.trim()) { editor.error = "Display name is required"; return; }
    if (!editor.model.trim()) { editor.error = "Model is required"; return; }
    if (editor.endpointMode === "custom" && !editor.endpointCustom.trim()) {
      editor.error = "Custom endpoint URL is required"; return;
    }
    if (!editor.apiKeyIsExisting && !editor.apiKey.trim()) {
      editor.error = "API key is required"; return;
    }

    editor.saving = true;
    try {
      const body = {
        displayName: editor.displayName.trim(),
        provider: editor.provider,
        endpoint: resolvedEndpoint(editor),
        model: editor.model.trim(),
        maxContextTokens: editor.maxContextTokens,
        tags: parseTags(editor.tagsInput),
        ...(editor.apiKey.trim() ? { apiKey: editor.apiKey.trim() } : {}),
      };

      let res: Response;
      if (editor.id) {
        res = await fetch(`/api/ai/${editor.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, apiKey: editor.apiKey.trim() }),
        });
      }
      const payload = (await res.json().catch(() => ({}))) as {
        connection?: AiConnectionPublic;
        error?: string;
      };
      if (!res.ok) {
        editor.error = payload.error ?? `HTTP ${res.status}`;
        return;
      }
      editor = null;
      await refresh();
    } catch (err) {
      if (editor) editor.error = err instanceof Error ? err.message : "Failed to save";
    } finally {
      if (editor) editor.saving = false;
    }
  }

  async function testEditor() {
    if (!editor) return;
    if (!editor.id) {
      // Unsaved connection — must save first to get an id
      editor.error = "Save the connection before testing.";
      return;
    }
    editor.testing = true;
    editor.testResult = null;
    try {
      const res = await fetch(`/api/ai/${editor.id}/test`, { method: "POST" });
      editor.testResult = (await res.json().catch(() => ({
        ok: false,
        error: "invalid response",
        durationMs: 0,
      }))) as EditorState["testResult"];
    } catch (err) {
      editor.testResult = {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to test",
        durationMs: 0,
      };
    } finally {
      if (editor) editor.testing = false;
    }
  }

  async function removeConnection(id: string) {
    if (!confirm("Delete this AI connection?")) return;
    try {
      const res = await fetch(`/api/ai/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        error = body.error ?? `HTTP ${res.status}`;
        return;
      }
      await refresh();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to delete";
    }
  }

  async function makeDefault(id: string) {
    try {
      const res = await fetch(`/api/ai/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setAsDefault: true }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        error = body.error ?? `HTTP ${res.status}`;
        return;
      }
      await refresh();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to set default";
    }
  }
</script>

<SEO
  title="AI connections | filepath"
  description="Connect AI inference endpoints for your filepath agents."
  keywords="filepath ai model inference"
  path="/settings/ai"
  type="website"
  section="Settings"
  tags="settings,ai"
  noindex
  breadcrumbs={[
    { name: "Dashboard", item: "/dashboard" },
    { name: "AI", item: "/settings/ai" },
  ]}
/>

<div class="min-h-screen bg-gray-50 font-sans text-gray-700 transition-colors duration-200 dark:bg-neutral-950 dark:text-neutral-300">
  <main class="mx-auto max-w-3xl px-6 py-12">
    <div class="mb-10 flex items-center justify-between">
      <div>
        <h1 class="mb-1 text-xl font-medium text-gray-900 dark:text-neutral-100">AI connections</h1>
        <p class="text-sm text-gray-500 dark:text-neutral-500">
          Connect inference endpoints. Agents pick which connection to use when you create them.
        </p>
      </div>
      <div class="flex gap-3">
        <a
          href="/dashboard"
          class="rounded border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:border-gray-400 dark:border-neutral-800 dark:text-neutral-400 dark:hover:border-neutral-600"
          >Back</a
        >
        <Button
          class="gap-2"
          onclick={openCreate}
          data-testid="ai-add-button"
        >
          <PlusIcon size={16} />
          <span>Add connection</span>
        </Button>
      </div>
    </div>

    {#if error}
      <div class="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
        {error}
        <button class="ml-2 underline" onclick={() => (error = null)}>dismiss</button>
      </div>
    {/if}

    {#if connections.length === 0}
      <div class="rounded border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
        No AI connections yet. Click <strong>Add connection</strong> to get started.
      </div>
    {:else}
      <div class="overflow-hidden rounded border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        {#each connections as conn (conn.id)}
          <div
            class="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0 dark:border-neutral-800"
            data-testid={`ai-row-${conn.id}`}
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="truncate text-sm font-medium text-gray-900 dark:text-neutral-100">
                  {conn.displayName}
                </span>
                {#if conn.isDefault}
                  <span class="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                    default
                  </span>
                {/if}
              </div>
              <div class="mt-0.5 truncate font-mono text-xs text-gray-500 dark:text-neutral-500">
                {conn.model} · {PROVIDER_LABEL[conn.provider]}
              </div>
              <div class="mt-0.5 truncate font-mono text-[10px] text-gray-400 dark:text-neutral-600">
                {conn.endpoint}
              </div>
              {#if conn.tags.length > 0}
                <div class="mt-0.5 flex flex-wrap gap-1">
                  {#each conn.tags as tag (tag)}
                    <span class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-neutral-800 dark:text-neutral-400">
                      {tag}
                    </span>
                  {/each}
                </div>
              {/if}
            </div>
            <div class="flex shrink-0 items-center gap-1">
              {#if !conn.isDefault}
                <button
                  type="button"
                  class="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:border-emerald-400 hover:text-emerald-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:border-emerald-700 dark:hover:text-emerald-400"
                  onclick={() => makeDefault(conn.id)}
                  aria-label={`Make ${conn.displayName} default`}
                >
                  make default
                </button>
              {/if}
              <button
                type="button"
                class="inline-flex size-7 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                onclick={() => openEdit(conn)}
                aria-label={`Edit ${conn.displayName}`}
                data-testid={`ai-edit-${conn.id}`}
              >
                <PencilIcon size={14} />
              </button>
              <button
                type="button"
                class="inline-flex size-7 items-center justify-center rounded text-gray-500 hover:bg-red-50 hover:text-red-700 dark:text-neutral-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                onclick={() => removeConnection(conn.id)}
                aria-label={`Delete ${conn.displayName}`}
                data-testid={`ai-delete-${conn.id}`}
              >
                <Trash2Icon size={14} />
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </main>

  {#if editor}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 z-100 flex items-start justify-center overflow-auto bg-black/50 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-editor-title"
      tabindex="-1"
      onclick={cancelEditor}
      onkeydown={(e) => { if (e.key === "Escape") cancelEditor(); }}
    >
      <div
        class="w-full max-w-lg rounded border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
        role="document"
      >
        <div class="mb-4 flex items-center justify-between">
          <h2 id="ai-editor-title" class="text-lg font-medium text-gray-900 dark:text-neutral-100">
            {editor.id ? "Edit connection" : "Add connection"}
          </h2>
          <button
            type="button"
            class="inline-flex size-7 items-center justify-center rounded text-gray-500 hover:bg-gray-100 dark:text-neutral-500 dark:hover:bg-neutral-800"
            onclick={cancelEditor}
            aria-label="Close"
          >
            <XIcon size={15} />
          </button>
        </div>

        <!-- provider picker -->
        <div class="mb-4">
          <label class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-neutral-500">
            Provider / API Format
          </label>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {#each Object.keys(PROVIDER_LABEL) as providerRaw (providerRaw)}
              {@const provider = providerRaw as ProviderFormat}
              <button
                type="button"
                class="rounded border px-2 py-2 text-xs font-medium transition-colors {editor.provider === provider ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'}"
                onclick={() => {
                  if (editor) {
                    editor.provider = provider;
                    editor.model = "";
                  }
                }}
              >
                {PROVIDER_LABEL[provider]}
              </button>
            {/each}
          </div>
        </div>

        <!-- endpoint: default vs custom -->
        <div class="mb-4">
          <label class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-neutral-500">
            Endpoint
          </label>
          <div class="mb-2 grid grid-cols-2 gap-0">
            <button
              type="button"
              class="rounded-l border px-2 py-1.5 text-xs {editor.endpointMode === 'default' ? 'border-gray-400 bg-gray-100 text-gray-900 dark:border-neutral-500 dark:bg-neutral-700 dark:text-neutral-100' : 'border-gray-200 bg-white text-gray-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400'}"
              onclick={() => { if (editor) editor.endpointMode = "default"; }}
            >
              Default endpoint
            </button>
            <button
              type="button"
              class="-ml-px rounded-r border px-2 py-1.5 text-xs {editor.endpointMode === 'custom' ? 'border-gray-400 bg-gray-100 text-gray-900 dark:border-neutral-500 dark:bg-neutral-700 dark:text-neutral-100' : 'border-gray-200 bg-white text-gray-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400'}"
              onclick={() => { if (editor) editor.endpointMode = "custom"; }}
            >
              Custom endpoint
            </button>
          </div>
          {#if editor.endpointMode === "default"}
            <div class="rounded border border-gray-200 bg-gray-50 px-2 py-1.5 font-mono text-xs text-gray-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
              {DEFAULT_ENDPOINT[editor.provider]}
            </div>
          {:else}
            <input
              type="url"
              bind:value={editor.endpointCustom}
              placeholder="https://gateway.ai.cloudflare.com/v1/..."
              class="w-full rounded border border-gray-200 bg-white px-2 py-1.5 font-mono text-xs text-gray-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
            />
          {/if}
        </div>

        <!-- model: presets + free text -->
        <div class="mb-4">
          <label class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-neutral-500">
            Model
          </label>
          <div class="mb-2 flex flex-wrap gap-1.5">
            {#each MODEL_PRESETS[editor.provider] as preset (preset.id)}
              <button
                type="button"
                class="rounded border px-2 py-1 text-xs font-medium transition-colors {editor.model === preset.id ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'}"
                onclick={() => { if (editor) editor.model = preset.id; }}
              >
                {preset.label}
              </button>
            {/each}
          </div>
          <input
            type="text"
            bind:value={editor.model}
            placeholder="model-id"
            class="w-full rounded border border-gray-200 bg-white px-2 py-1.5 font-mono text-sm text-gray-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
          />
        </div>

        <!-- display name -->
        <div class="mb-4">
          <label class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-neutral-500">
            Display name
          </label>
          <input
            type="text"
            bind:value={editor.displayName}
            placeholder="Opus 4.6 (personal)"
            class="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
          />
        </div>

        <!-- api key -->
        <div class="mb-4">
          <label class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-neutral-500">
            API Key{editor.apiKeyIsExisting ? " (leave blank to keep existing)" : ""}
          </label>
          <input
            type="password"
            bind:value={editor.apiKey}
            placeholder={editor.apiKeyIsExisting ? "(saved)" : "sk-..."}
            class="w-full rounded border border-gray-200 bg-white px-2 py-1.5 font-mono text-sm text-gray-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
          />
        </div>

        <!-- max tokens -->
        <div class="mb-4">
          <label class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-neutral-500">
            Max Context Tokens
          </label>
          <input
            type="number"
            bind:value={editor.maxContextTokens}
            min="1024"
            max="2000000"
            class="w-full rounded border border-gray-200 bg-white px-2 py-1.5 font-mono text-sm text-gray-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
          />
        </div>

        <!-- tags -->
        <div class="mb-4">
          <label class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-neutral-500">
            Tags
          </label>
          <input
            type="text"
            bind:value={editor.tagsInput}
            placeholder="comma-separated, e.g., slug, cheap"
            class="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
          />
        </div>

        <!-- test result display -->
        {#if editor.testResult}
          <div
            class="mb-4 rounded border px-3 py-2 text-xs {editor.testResult.ok ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300'}"
          >
            <div class="flex items-center gap-2">
              {#if editor.testResult.ok}
                <CheckIcon size={12} />
              {:else}
                <XIcon size={12} />
              {/if}
              <span class="font-medium">
                {editor.testResult.ok ? "Test passed" : "Test failed"}
              </span>
              <span class="text-[10px] opacity-70">
                ({editor.testResult.durationMs}ms)
              </span>
            </div>
            {#if editor.testResult.preview}
              <div class="mt-1 font-mono text-[11px] opacity-80">→ {editor.testResult.preview}</div>
            {/if}
            {#if editor.testResult.error}
              <div class="mt-1 font-mono text-[11px] opacity-80">{editor.testResult.error}</div>
            {/if}
          </div>
        {/if}

        {#if editor.error}
          <div class="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {editor.error}
          </div>
        {/if}

        <div class="flex justify-end gap-2">
          <Button variant="outline" onclick={cancelEditor} disabled={editor.saving || editor.testing}>
            Cancel
          </Button>
          {#if editor.id}
            <Button
              variant="outline"
              onclick={testEditor}
              disabled={editor.saving || editor.testing}
            >
              {editor.testing ? "Testing…" : "Test"}
            </Button>
          {/if}
          <Button onclick={saveEditor} disabled={editor.saving || editor.testing}>
            {editor.saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  {/if}
</div>
