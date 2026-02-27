<script lang="ts">
  import { browser } from '$app/environment';
  import { authClient } from '$lib/auth-client';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Nav from '$lib/components/Nav.svelte';

  let dark = $state(browser && document.documentElement.classList.contains('dark'));
  if (browser) {
    const observer = new MutationObserver(() => {
      dark = document.documentElement.classList.contains('dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }

  // ─── Delete account state ───
  let showDeleteDialog = $state(false);
  let password = $state('');
  let confirmText = $state('');
  let isDeleting = $state(false);
  let error = $state('');

  const CONFIRM_PHRASE = 'delete my account';

  // ─── Provider API Keys state ───
  let openrouterKey = $state('');
  let maskedKey = $state<string | null>(null);
  let keyLoading = $state(true);
  let keySaving = $state(false);
  let keyError = $state('');
  let keySuccess = $state('');
  let showKeyInput = $state(false);

  onMount(async () => {
    try {
      const res = await fetch('/api/user/keys');
      if (res.ok) {
        const data = await res.json() as { openrouter: string | null };
        maskedKey = data.openrouter;
      }
    } catch {
      // silently fail on load
    } finally {
      keyLoading = false;
    }
  });

  async function saveKey() {
    keySaving = true;
    keyError = '';
    keySuccess = '';

    try {
      const res = await fetch('/api/user/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'openrouter', key: openrouterKey.trim() || null }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: 'Failed to save' })) as { message?: string };
        keyError = errData.message || 'Failed to save key';
        return;
      }

      const data = await res.json() as { masked: string | null };
      maskedKey = data.masked;
      openrouterKey = '';
      showKeyInput = false;
      keySuccess = maskedKey ? 'Key saved' : 'Key removed';
      setTimeout(() => { keySuccess = ''; }, 3000);
    } catch (err) {
      keyError = err instanceof Error ? err.message : 'Failed to save key';
    } finally {
      keySaving = false;
    }
  }

  async function removeKey() {
    openrouterKey = '';
    keySaving = true;
    keyError = '';

    try {
      const res = await fetch('/api/user/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'openrouter', key: null }),
      });

      if (res.ok) {
        maskedKey = null;
        showKeyInput = false;
        keySuccess = 'Key removed';
        setTimeout(() => { keySuccess = ''; }, 3000);
      }
    } catch {
      keyError = 'Failed to remove key';
    } finally {
      keySaving = false;
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
</script>

<div class="min-h-screen font-sans {dark ? 'bg-neutral-950 text-neutral-300' : 'bg-gray-50 text-gray-700'} transition-colors duration-200">
	<Nav current="account" />

  <main class="max-w-2xl mx-auto px-6 py-12">
    <div class="flex items-center justify-between mb-10">
      <div>
        <h1 class="text-xl font-medium mb-1 {dark ? 'text-neutral-100' : 'text-gray-900'}">Account</h1>
        <p class="text-sm {dark ? 'text-neutral-500' : 'text-gray-500'}">Manage your account settings</p>
      </div>
			<a href="/dashboard" class="px-4 py-2 text-sm border rounded transition-colors {dark ? 'text-neutral-400 border-neutral-800 hover:border-neutral-600' : 'text-gray-600 border-gray-200 hover:border-gray-400'}">Back</a>
    </div>

    <section class="mb-10">
      <h2 class="text-xs uppercase tracking-wide mb-4 {dark ? 'text-neutral-500' : 'text-gray-500'}">Account information</h2>
      <div class="border rounded p-5 transition-colors duration-200 {dark ? 'bg-neutral-900 border-neutral-800' : 'bg-gray-100 border-gray-200'}">
        <p class="text-sm {dark ? 'text-neutral-400' : 'text-gray-600'}">Your account details are managed through your profile settings.</p>
      </div>
    </section>

    <section class="mb-10">
      <h2 class="text-xs uppercase tracking-wide mb-4 {dark ? 'text-neutral-500' : 'text-gray-500'}">Provider API Keys</h2>
      <div class="border rounded p-5 transition-colors duration-200 {dark ? 'bg-neutral-900 border-neutral-800' : 'bg-gray-100 border-gray-200'}">
        <p class="text-sm mb-4 {dark ? 'text-neutral-400' : 'text-gray-600'}">
          Bring your own API key. Your key is encrypted at rest and never shared.
        </p>

        <div class="mb-2">
          <label for="openrouter-key" class="text-xs uppercase tracking-wide {dark ? 'text-neutral-500' : 'text-gray-500'}">OpenRouter API Key</label>
        </div>

        {#if keyLoading}
          <p class="text-sm {dark ? 'text-neutral-600' : 'text-gray-400'}">Loading...</p>
        {:else if maskedKey && !showKeyInput}
          <div class="flex items-center gap-3">
            <code class="text-sm px-3 py-2 rounded border font-mono transition-colors duration-200 {dark ? 'text-neutral-400 bg-neutral-950 border-neutral-800' : 'text-gray-600 bg-gray-50 border-gray-200'}">{maskedKey}</code>
            <button
              onclick={() => { showKeyInput = true; openrouterKey = ''; }}
              class="px-3 py-1.5 text-xs border rounded transition-colors cursor-pointer {dark ? 'text-neutral-400 border-neutral-800 hover:border-neutral-600' : 'text-gray-600 border-gray-200 hover:border-gray-400'}"
            >
              change
            </button>
            <button
              onclick={removeKey}
              disabled={keySaving}
              class="px-3 py-1.5 text-xs text-red-400/70 border border-neutral-800 rounded hover:border-red-900 transition-colors cursor-pointer disabled:opacity-50"
            >
              remove
            </button>
          </div>
        {:else}
          <div class="flex gap-2">
            <input
              id="openrouter-key"
              type="password"
              placeholder="sk-or-v1-..."
              bind:value={openrouterKey}
              class="flex-1 px-3 py-2 border rounded text-sm font-mono focus:outline-none transition-colors duration-200 {dark ? 'bg-neutral-950 border-neutral-800 text-neutral-200 placeholder:text-neutral-700 focus:border-neutral-600' : 'bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 focus:border-gray-400'}"
            />
            <button
              onclick={saveKey}
              disabled={keySaving || !openrouterKey.trim()}
              class="px-4 py-2 text-sm border rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed {dark ? 'text-neutral-200 bg-neutral-800 border-neutral-700 hover:bg-neutral-700' : 'text-gray-800 bg-gray-200 border-gray-300 hover:bg-gray-300'}"
            >
              {keySaving ? 'saving...' : 'save'}
            </button>
            {#if showKeyInput}
              <button
                onclick={() => { showKeyInput = false; openrouterKey = ''; keyError = ''; }}
                class="px-3 py-2 text-sm cursor-pointer {dark ? 'text-neutral-500 hover:text-neutral-300' : 'text-gray-500 hover:text-gray-700'}"
              >
                cancel
              </button>
            {/if}
          </div>
          <p class="text-xs mt-2 {dark ? 'text-neutral-600' : 'text-gray-400'}">
            Get your key at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener" class="underline {dark ? 'text-neutral-400 hover:text-neutral-300' : 'text-gray-600 hover:text-gray-800'}">openrouter.ai/keys</a>
          </p>
        {/if}

        {#if keyError}
          <p class="text-red-400 text-sm mt-2">{keyError}</p>
        {/if}
        {#if keySuccess}
          <p class="text-green-400/70 text-sm mt-2">{keySuccess}</p>
        {/if}
      </div>
    </section>

    <section>
      <h2 class="text-red-400/80 text-xs uppercase tracking-wide mb-4">Danger zone</h2>
      <div class="bg-neutral-900 border border-red-900/50 rounded p-5">
        <p class="text-sm mb-4 {dark ? 'text-neutral-400' : 'text-gray-600'}">
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
  <div class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center" onclick={() => showDeleteDialog = false}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="border rounded-lg p-6 max-w-md w-full mx-4 transition-colors duration-200 {dark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'}" onclick={(e) => e.stopPropagation()}>
      <h2 class="text-red-400 text-lg font-medium mb-2">Delete account</h2>
      <p class="text-sm mb-2 {dark ? 'text-neutral-400' : 'text-gray-600'}">This will permanently delete:</p>
      <ul class="text-sm space-y-1 mb-6 ml-4 {dark ? 'text-neutral-500' : 'text-gray-500'}">
        <li class="flex gap-2"><span class="{dark ? 'text-neutral-600' : 'text-gray-400'}">•</span> All sessions and terminals</li>
        <li class="flex gap-2"><span class="{dark ? 'text-neutral-600' : 'text-gray-400'}">•</span> All API keys</li>
        <li class="flex gap-2"><span class="{dark ? 'text-neutral-600' : 'text-gray-400'}">•</span> Credit balance (non-refundable)</li>
        <li class="flex gap-2"><span class="{dark ? 'text-neutral-600' : 'text-gray-400'}">•</span> Usage history</li>
      </ul>

      <div class="space-y-4">
        <div>
          <label for="password" class="text-xs uppercase tracking-wide {dark ? 'text-neutral-500' : 'text-gray-500'}">Password</label>
          <input
            id="password"
            type="password"
            placeholder="Enter your password"
            bind:value={password}
            class="w-full mt-1 px-3 py-2 border rounded text-sm focus:outline-none transition-colors duration-200 {dark ? 'bg-neutral-950 border-neutral-800 text-neutral-200 placeholder:text-neutral-700 focus:border-neutral-600' : 'bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 focus:border-gray-400'}"
          />
        </div>

        <div>
          <label for="confirm" class="text-xs uppercase tracking-wide {dark ? 'text-neutral-500' : 'text-gray-500'}">Type "{CONFIRM_PHRASE}" to confirm</label>
          <input
            id="confirm"
            type="text"
            placeholder={CONFIRM_PHRASE}
            bind:value={confirmText}
            class="w-full mt-1 px-3 py-2 border rounded text-sm focus:outline-none transition-colors duration-200 {dark ? 'bg-neutral-950 border-neutral-800 text-neutral-200 placeholder:text-neutral-700 focus:border-neutral-600' : 'bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 focus:border-gray-400'}"
          />
        </div>

        {#if error}
          <p class="text-red-400 text-sm">{error}</p>
        {/if}
      </div>

      <div class="flex justify-end gap-3 mt-6">
        <button
          onclick={() => showDeleteDialog = false}
          class="px-4 py-2 text-sm border rounded transition-colors cursor-pointer {dark ? 'text-neutral-400 border-neutral-800 hover:border-neutral-600' : 'text-gray-600 border-gray-200 hover:border-gray-400'}"
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
