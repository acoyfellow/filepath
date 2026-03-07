<script lang="ts">
  import { authClient } from '$lib/auth-client';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { PROVIDER_IDS, PROVIDERS, type ProviderId } from '$lib/provider-keys';
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
  const providerList = PROVIDER_IDS.map((id) => PROVIDERS[id]);
  let providerStates = $state<Record<ProviderId, {
    masked: string | null;
    draft: string;
    saving: boolean;
    error: string;
    success: string;
    showInput: boolean;
  }>>({
    openrouter: { masked: null, draft: '', saving: false, error: '', success: '', showInput: false },
    zen: { masked: null, draft: '', saving: false, error: '', success: '', showInput: false },
  });

  onMount(async () => {
    try {
      const res = await fetch('/api/user/keys');
      const data = await res.json().catch(() => ({})) as {
        error?: string;
        keys?: Record<ProviderId, string | null>;
      };
      if (!res.ok) {
        keysLoadError = data.error || 'Failed to load provider keys';
        return;
      }
      const keys = data.keys ?? { openrouter: null, zen: null };
      for (const provider of PROVIDER_IDS) {
        providerStates[provider].masked = keys[provider] ?? null;
      }
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

      const data = await res.json() as {
        keys?: Record<ProviderId, string | null>;
      };
      const keys = data.keys ?? { openrouter: null, zen: null };
      for (const id of PROVIDER_IDS) {
        providerStates[id].masked = keys[id] ?? null;
      }
      state.draft = '';
      state.showInput = false;
      state.success = state.masked ? 'Key saved' : 'Key removed';
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
        const data = await res.json() as {
          keys?: Record<ProviderId, string | null>;
        };
        const keys = data.keys ?? { openrouter: null, zen: null };
        for (const id of PROVIDER_IDS) {
          providerStates[id].masked = keys[id] ?? null;
        }
        state.showInput = false;
        state.success = 'Key removed';
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
      <h2 class="text-xs uppercase tracking-wide mb-4 text-gray-500 dark:text-neutral-500">Provider Router Keys</h2>
      <div class="border rounded p-5 transition-colors duration-200 bg-gray-100 border-gray-200 dark:bg-neutral-900 dark:border-neutral-800">
        <p class="text-sm mb-4 text-gray-600 dark:text-neutral-400">
          Bring your own router key. Your key is encrypted at rest and never shared.
        </p>

        {#if keysLoadError}
          <div class="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300">
            {keysLoadError}
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
                    <label for={`${provider.id}-key`} class="text-xs uppercase tracking-wide text-gray-500 dark:text-neutral-500">{provider.label}</label>
                    <p class="text-xs mt-1 text-gray-400 dark:text-neutral-600">{provider.helpText}</p>
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

                {#if providerStates[provider.id].masked && !providerStates[provider.id].showInput}
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
                {:else}
                  <div class="flex gap-2">
                    <input
                      id={`${provider.id}-key`}
                      type="password"
                      placeholder={provider.keyPlaceholder}
                      bind:value={providerStates[provider.id].draft}
                      class="flex-1 px-3 py-2 border rounded text-sm font-mono focus:outline-none transition-colors duration-200 bg-white border-gray-200 text-gray-800 placeholder:text-gray-400 focus:border-gray-400 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-200 dark:placeholder:text-neutral-700 dark:focus:border-neutral-600"
                    />
                    <button
                      onclick={() => saveKey(provider.id)}
                      disabled={providerStates[provider.id].saving || !providerStates[provider.id].draft.trim()}
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
      <h2 class="text-red-400/80 text-xs uppercase tracking-wide mb-4">Danger zone</h2>
      <div class="bg-neutral-900 border border-red-900/50 rounded p-5">
        <p class="text-sm mb-4 text-gray-600 dark:text-neutral-400">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <button 
          onclick={() => showDeleteDialog = true}
          class="px-4 py-2 text-sm text-red-400 border border-red-900 rounded hover:bg-red-950 transition-colors cursor-pointer"
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
        <li class="flex gap-2"><span class="text-gray-400 dark:text-neutral-600">•</span> All sessions and thread history</li>
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
