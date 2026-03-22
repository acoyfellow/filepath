<script lang="ts">
  import { authClient } from '$lib/auth-client';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import SEO from '$lib/components/SEO.svelte';
  import { PROVIDER_IDS, PROVIDERS, type ProviderId } from '$lib/provider-keys';
  type ProviderKeyStateStatus = 'saved' | 'missing' | 'unreadable';
  type ProviderKeysStatus = 'ready' | 'missing' | 'unreadable';
  // ─── Delete account state ───
  let showDeleteDialog = $state(false);
  let password = $state('');
  let confirmText = $state('');
  let isDeleting = $state(false);
  let error = $state('');

  const CONFIRM_PHRASE = 'delete my account';

  // ─── Provider API Keys state ───
  let keyLoading = $state(true);
  let keysLoadError = $state('');
  let keysStatus = $state<ProviderKeysStatus>('missing');
  let keysMessage = $state('');
  const providerList = PROVIDER_IDS.map((id) => PROVIDERS[id]);
  let providerStates = $state<Record<ProviderId, {
    masked: string | null;
    status: ProviderKeyStateStatus;
    message: string;
    draft: string;
    saving: boolean;
    error: string;
    success: string;
    showInput: boolean;
  }>>({
    openrouter: { masked: null, status: 'missing', message: '', draft: '', saving: false, error: '', success: '', showInput: false },
    zen: { masked: null, status: 'missing', message: '', draft: '', saving: false, error: '', success: '', showInput: false },
  });

  function applyKeysPayload(data: {
    status?: ProviderKeysStatus;
    message?: string | null;
    error?: string;
    keys?: Record<ProviderId, string | null>;
    states?: Record<ProviderId, {
      masked: string | null;
      status: ProviderKeyStateStatus;
      message: string;
    }>;
  }) {
    keysStatus = data.status ?? 'missing';
    keysMessage = data.message ?? '';
    keysLoadError = data.error ?? '';

    const keys = data.keys ?? { openrouter: null, zen: null };
    const states = data.states ?? {
      openrouter: {
        masked: keys.openrouter ?? null,
        status: keys.openrouter ? 'saved' : 'missing',
        message: keys.openrouter ? 'OpenRouter is ready for live runs.' : 'No OpenRouter key saved yet.',
      },
      zen: {
        masked: keys.zen ?? null,
        status: keys.zen ? 'saved' : 'missing',
        message: keys.zen ? 'OpenCode Zen is ready for live runs.' : 'No OpenCode Zen key saved yet.',
      },
    };

    for (const provider of PROVIDER_IDS) {
      providerStates[provider].masked = states[provider]?.masked ?? null;
      providerStates[provider].status = states[provider]?.status ?? 'missing';
      providerStates[provider].message = states[provider]?.message ?? '';
    }
  }

  onMount(async () => {
    try {
      const res = await fetch('/api/user/keys');
      const data = await res.json().catch(() => ({})) as Parameters<typeof applyKeysPayload>[0];
      applyKeysPayload(data);
    } catch {
      keysLoadError = 'Failed to load provider keys';
    } finally {
      keyLoading = false;
    }
  });

  async function saveKey(provider: ProviderId) {
    const state = providerStates[provider];
    state.saving = true;
    state.error = '';
    state.success = '';

    try {
      const res = await fetch('/api/user/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, key: state.draft.trim() || null }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null) as { message?: string } | null;
        state.error = errData?.message || 'Failed to save key';
        return;
      }

      const data = await res.json() as Parameters<typeof applyKeysPayload>[0];
      applyKeysPayload(data);
      state.draft = '';
      state.showInput = false;
      state.success = data.message || 'Key saved';
      setTimeout(() => { state.success = ''; }, 3000);
    } catch (err) {
      state.error = err instanceof Error ? err.message : 'Failed to save key';
    } finally {
      state.saving = false;
    }
  }

  async function removeKey(provider: ProviderId) {
    const state = providerStates[provider];
    state.draft = '';
    state.saving = true;
    state.error = '';

    try {
      const res = await fetch('/api/user/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, key: null }),
      });

      if (res.ok) {
        const data = await res.json() as Parameters<typeof applyKeysPayload>[0];
        applyKeysPayload(data);
        state.showInput = false;
        state.success = data.message || 'Key removed';
        setTimeout(() => { state.success = ''; }, 3000);
      } else {
        const errData = await res.json().catch(() => null) as { message?: string } | null;
        state.error = errData?.message || 'Failed to remove key';
      }
    } catch {
      state.error = 'Failed to remove key';
    } finally {
      state.saving = false;
    }
  }

  async function clearStoredKeys() {
    keysLoadError = '';
    keysMessage = '';
    for (const provider of PROVIDER_IDS) {
      providerStates[provider].saving = true;
      providerStates[provider].error = '';
      providerStates[provider].success = '';
    }

    try {
      const res = await fetch('/api/user/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearAll: true }),
      });
      const data = await res.json().catch(() => ({})) as Parameters<typeof applyKeysPayload>[0] & { message?: string };
      if (!res.ok) {
        keysLoadError = data.message || 'Failed to clear provider keys';
        return;
      }
      applyKeysPayload(data);
      keysMessage = data.message || 'Stored model provider keys were cleared.';
      for (const provider of PROVIDER_IDS) {
        providerStates[provider].draft = '';
        providerStates[provider].showInput = false;
        providerStates[provider].success = keysMessage;
        setTimeout(() => { providerStates[provider].success = ''; }, 3000);
      }
    } catch {
      keysLoadError = 'Failed to clear provider keys';
    } finally {
      for (const provider of PROVIDER_IDS) {
        providerStates[provider].saving = false;
      }
    }
  }

  async function handleDelete() {
    if (confirmText.toLowerCase() !== CONFIRM_PHRASE) {
      error = `Please type "${CONFIRM_PHRASE}" to confirm`;
      return;
    }

    isDeleting = true;
    error = '';

    try {
      const response = await authClient.deleteUser({
        password: password || undefined
      });

      if (response.error) {
        error = response.error.message || 'Failed to delete account';
        isDeleting = false;
        return;
      }

      await goto('/');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to delete account';
      isDeleting = false;
    }
  }

  function closeDeleteDialog() {
    showDeleteDialog = false;
  }

  function handleDeleteDialogBackdropKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      closeDeleteDialog();
    }
  }

  function stopDeleteDialogKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeDeleteDialog();
      return;
    }
    e.stopPropagation();
  }
</script>

<SEO
  title="Account settings | filepath"
  description="Manage your filepath account, provider keys, and account-level settings."
  keywords="filepath account settings"
  path="/settings/account"
  type="website"
  section="Settings"
  tags="settings,account"
  noindex
  breadcrumbs={[
    { name: "Dashboard", item: "/dashboard" },
    { name: "Account settings", item: "/settings/account" },
  ]}
/>

<div class="min-h-screen font-sans bg-gray-50 text-gray-700 dark:bg-neutral-950 dark:text-neutral-300 transition-colors duration-200">
  <main class="max-w-2xl mx-auto px-6 py-12">
    <div class="flex items-center justify-between mb-10">
      <div>
        <h1 class="text-xl font-medium mb-1 text-gray-900 dark:text-neutral-100">Account</h1>
        <p class="text-sm text-gray-500 dark:text-neutral-500">Manage your account settings</p>
      </div>
			<a href="/dashboard" class="px-4 py-2 text-sm border rounded transition-colors text-gray-600 border-gray-200 hover:border-gray-400 dark:text-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600">Back</a>
    </div>

    <section class="mb-10">
      <h2 class="text-xs uppercase tracking-wide mb-4 text-gray-500 dark:text-neutral-500">Account information</h2>
      <div class="border rounded p-5 transition-colors duration-200 bg-gray-100 border-gray-200 dark:bg-neutral-900 dark:border-neutral-800">
        <p class="text-sm text-gray-600 dark:text-neutral-400">Your account details are managed through your profile settings.</p>
        {#if page.data.user?.role === 'admin'}
          <div class="mt-4">
            <a
              href="/settings/harnesses"
              class="inline-flex rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 transition-colors hover:border-gray-400 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-500"
            >
              manage harness registry
            </a>
          </div>
        {/if}
      </div>
    </section>

    <section class="mb-10">
      <h2 class="text-xs uppercase tracking-wide mb-4 text-gray-500 dark:text-neutral-500">Model Provider Keys</h2>
      <div class="border rounded p-5 transition-colors duration-200 bg-gray-100 border-gray-200 dark:bg-neutral-900 dark:border-neutral-800">
        <p class="text-sm mb-4 text-gray-600 dark:text-neutral-400">
          Save the model provider keys that power live agent runs here. filepath API keys for programmatic access live in
          <a href="/settings/api-keys" class="ml-1 underline hover:text-gray-700 dark:hover:text-neutral-200">Settings → API Keys</a>.
        </p>

        {#if keysLoadError}
          <div class="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300">
            {keysLoadError}
          </div>
        {/if}

        {#if keysMessage}
          <div class="mb-4 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
            {keysMessage}
          </div>
        {/if}

        {#if keysStatus === 'unreadable'}
          <div class="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
            <div class="font-medium">Saved provider keys need repair</div>
            <div class="mt-1">filepath can’t decrypt the stored model provider keys. Clear them, then re-save the keys you want to keep.</div>
            <button
              onclick={clearStoredKeys}
              class="mt-3 px-3 py-1.5 text-xs border rounded transition-colors cursor-pointer text-amber-900 border-amber-300 hover:bg-amber-100 dark:text-amber-100 dark:border-amber-800 dark:hover:bg-amber-950/60"
            >
              clear saved provider keys
            </button>
          </div>
        {/if}

        {#if keyLoading}
          <p class="text-sm text-gray-400 dark:text-neutral-600">Loading...</p>
        {:else}
          <div class="space-y-5">
            {#each providerList as provider (provider.id)}
              <div class="border rounded p-4 bg-gray-50 border-gray-200 dark:bg-neutral-950 dark:border-neutral-800">
                <div class="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div class="flex items-center gap-2">
                      <label for={`${provider.id}-key`} class="text-xs uppercase tracking-wide text-gray-500 dark:text-neutral-500">{provider.label}</label>
                      <span class={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                        providerStates[provider.id].status === 'saved'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : providerStates[provider.id].status === 'unreadable'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200'
                            : 'bg-gray-200 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400'
                      }`}>
                        {providerStates[provider.id].status}
                      </span>
                    </div>
                    <p class="text-xs mt-1 text-gray-400 dark:text-neutral-600">{provider.helpText}</p>
                    <p class="text-xs mt-1 text-gray-500 dark:text-neutral-500">{providerStates[provider.id].message}</p>
                  </div>
                  <a
                    href={provider.docsUrl}
                    target="_blank"
                    rel="noopener"
                    class="text-xs underline text-gray-500 hover:text-gray-700 dark:text-neutral-500 dark:hover:text-neutral-300"
                  >
                    get key
                  </a>
                </div>

                {#if providerStates[provider.id].status === 'saved' && providerStates[provider.id].masked && !providerStates[provider.id].showInput}
                  <div class="flex items-center gap-3">
                    <code class="text-sm px-3 py-2 rounded border font-mono transition-colors duration-200 text-gray-600 bg-white border-gray-200 dark:text-neutral-400 dark:bg-neutral-900 dark:border-neutral-800">
                      {providerStates[provider.id].masked}
                    </code>
                    <button
                      onclick={() => {
                        providerStates[provider.id].showInput = true;
                        providerStates[provider.id].draft = '';
                        providerStates[provider.id].error = '';
                      }}
                      class="px-3 py-1.5 text-xs border rounded transition-colors cursor-pointer text-gray-600 border-gray-200 hover:border-gray-400 dark:text-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
                    >
                      change
                    </button>
                    <button
                      onclick={() => removeKey(provider.id)}
                      disabled={providerStates[provider.id].saving}
                      class="px-3 py-1.5 text-xs text-red-400/70 border border-neutral-800 rounded hover:border-red-900 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      remove
                    </button>
                  </div>
                {:else if providerStates[provider.id].status === 'unreadable'}
                  <div class="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
                    Clear the unreadable provider keys above, then save a fresh {provider.label} key here.
                  </div>
                {:else}
                  <div class="flex gap-2">
                    <input
                      id={`${provider.id}-key`}
                      type="password"
                      placeholder={provider.keyPlaceholder}
                      bind:value={providerStates[provider.id].draft}
                      disabled={keysStatus === 'unreadable'}
                      class="flex-1 px-3 py-2 border rounded text-sm font-mono focus:outline-none transition-colors duration-200 bg-white border-gray-200 text-gray-800 placeholder:text-gray-400 focus:border-gray-400 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-200 dark:placeholder:text-neutral-700 dark:focus:border-neutral-600"
                    />
                    <button
                      onclick={() => saveKey(provider.id)}
                      disabled={keysStatus === 'unreadable' || providerStates[provider.id].saving || !providerStates[provider.id].draft.trim()}
                      class="px-4 py-2 text-sm border rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-gray-800 bg-gray-200 border-gray-300 hover:bg-gray-300 dark:text-neutral-200 dark:bg-neutral-800 dark:border-neutral-700 dark:hover:bg-neutral-700"
                    >
                      {providerStates[provider.id].saving ? 'saving...' : 'save'}
                    </button>
                    {#if providerStates[provider.id].showInput}
                      <button
                        onclick={() => {
                          providerStates[provider.id].showInput = false;
                          providerStates[provider.id].draft = '';
                          providerStates[provider.id].error = '';
                        }}
                        class="px-3 py-2 text-sm cursor-pointer text-gray-500 hover:text-gray-700 dark:text-neutral-500 dark:hover:text-neutral-300"
                      >
                        cancel
                      </button>
                    {/if}
                  </div>
                {/if}

                {#if providerStates[provider.id].error}
                  <p class="text-red-400 text-sm mt-2">{providerStates[provider.id].error}</p>
                {/if}
                {#if providerStates[provider.id].success}
                  <p class="text-green-400/70 text-sm mt-2">{providerStates[provider.id].success}</p>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </section>

    <section>
      <h2 class="mb-4 text-xs uppercase tracking-wide text-red-700 dark:text-red-400/80">Danger zone</h2>
      <div
        class="rounded border p-5 border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-neutral-900"
      >
        <p class="mb-4 text-sm text-gray-900 dark:text-neutral-400">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <button
          type="button"
          onclick={() => (showDeleteDialog = true)}
          class="cursor-pointer rounded border border-red-300 bg-white px-4 py-2 text-sm text-red-700 transition-colors hover:bg-red-100 dark:border-red-900 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-950"
        >
          delete account
        </button>
      </div>
    </section>
  </main>
</div>

{#if showDeleteDialog}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center"
    onclick={closeDeleteDialog}
    onkeydown={handleDeleteDialogBackdropKeydown}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="border rounded-lg p-6 max-w-md w-full mx-4 transition-colors duration-200 bg-white border-gray-200 dark:bg-neutral-900 dark:border-neutral-800"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={stopDeleteDialogKeydown}
    >
      <h2 class="text-red-400 text-lg font-medium mb-2" id="delete-account-title">Delete account</h2>
      <p class="text-sm mb-2 text-gray-600 dark:text-neutral-400">This will permanently delete:</p>
      <ul class="text-sm space-y-1 mb-6 ml-4 text-gray-500 dark:text-neutral-500">
        <li class="flex gap-2"><span class="text-gray-400 dark:text-neutral-600">•</span> All workspaces, agents, and task history</li>
        <li class="flex gap-2"><span class="text-gray-400 dark:text-neutral-600">•</span> All API keys</li>
        <li class="flex gap-2"><span class="text-gray-400 dark:text-neutral-600">•</span> Credit balance (non-refundable)</li>
        <li class="flex gap-2"><span class="text-gray-400 dark:text-neutral-600">•</span> Usage history</li>
      </ul>

      <div class="space-y-4">
        <div>
          <label for="password" class="text-xs uppercase tracking-wide text-gray-500 dark:text-neutral-500">Password</label>
          <input
            id="password"
            type="password"
            placeholder="Enter your password"
            bind:value={password}
            class="w-full mt-1 px-3 py-2 border rounded text-sm focus:outline-none transition-colors duration-200 bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 focus:border-gray-400 dark:bg-neutral-950 dark:border-neutral-800 dark:text-neutral-200 dark:placeholder:text-neutral-700 dark:focus:border-neutral-600"
          />
        </div>

        <div>
          <label for="confirm" class="text-xs uppercase tracking-wide text-gray-500 dark:text-neutral-500">Type "{CONFIRM_PHRASE}" to confirm</label>
          <input
            id="confirm"
            type="text"
            placeholder={CONFIRM_PHRASE}
            bind:value={confirmText}
            class="w-full mt-1 px-3 py-2 border rounded text-sm focus:outline-none transition-colors duration-200 bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 focus:border-gray-400 dark:bg-neutral-950 dark:border-neutral-800 dark:text-neutral-200 dark:placeholder:text-neutral-700 dark:focus:border-neutral-600"
          />
        </div>

        {#if error}
          <p class="text-red-400 text-sm">{error}</p>
        {/if}
      </div>

      <div class="flex justify-end gap-3 mt-6">
        <button
          onclick={() => showDeleteDialog = false}
          class="px-4 py-2 text-sm border rounded transition-colors cursor-pointer text-gray-600 border-gray-200 hover:border-gray-400 dark:text-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
        >
          cancel
        </button>
        <button 
          onclick={handleDelete}
          disabled={isDeleting || confirmText.toLowerCase() !== CONFIRM_PHRASE}
          class="px-4 py-2 text-sm text-red-400 border border-red-900 rounded hover:bg-red-950 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDeleting ? 'deleting…' : 'delete my account'}
        </button>
      </div>
    </div>
  </div>
{/if}
