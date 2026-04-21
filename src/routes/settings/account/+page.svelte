<script lang="ts">
  import { authClient } from '$lib/auth-client';
  import { goto } from '$app/navigation';
  import SEO from '$lib/components/SEO.svelte';

  let showDeleteDialog = $state(false);
  let password = $state('');
  let confirmText = $state('');
  let isDeleting = $state(false);
  let error = $state('');

  const CONFIRM_PHRASE = 'delete my account';

  async function handleDelete() {
    if (confirmText.toLowerCase() !== CONFIRM_PHRASE) {
      error = `Please type "${CONFIRM_PHRASE}" to confirm`;
      return;
    }

    isDeleting = true;
    error = '';

    try {
      const response = await authClient.deleteUser({
        password: password || undefined,
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
    password = '';
    confirmText = '';
    error = '';
  }
</script>

<SEO
  title="Account settings | filepath"
  description="Manage your filepath account."
  keywords="filepath account settings"
  path="/settings/account"
  type="website"
  section="Settings"
  tags="settings,account"
  noindex
  breadcrumbs={[
    { name: 'Dashboard', item: '/dashboard' },
    { name: 'Account', item: '/settings/account' },
  ]}
/>

<div class="min-h-screen bg-gray-50 font-sans text-gray-700 transition-colors duration-200 dark:bg-neutral-950 dark:text-neutral-300">
  <main class="mx-auto max-w-3xl px-6 py-12">
    <div class="mb-10 flex items-center justify-between">
      <div>
        <h1 class="mb-1 text-xl font-medium text-gray-900 dark:text-neutral-100">Account</h1>
        <p class="text-sm text-gray-500 dark:text-neutral-500">Manage your filepath account.</p>
      </div>
      <div class="flex gap-3">
        <a
          href="/dashboard"
          class="rounded border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:border-gray-400 dark:border-neutral-800 dark:text-neutral-400 dark:hover:border-neutral-600"
          >Back</a
        >
      </div>
    </div>

    <section class="mb-8 rounded border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 class="mb-1 text-sm font-medium text-gray-900 dark:text-neutral-100">Model inference</h2>
      <p class="mb-3 text-sm text-gray-600 dark:text-neutral-400">
        Connect AI inference endpoints in <a href="/settings/ai" class="underline hover:text-gray-900 dark:hover:text-neutral-200">Settings → AI</a>.
        Agents pick which connection to use when you create them.
      </p>
    </section>

    <section class="mb-8 rounded border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 class="mb-1 text-sm font-medium text-gray-900 dark:text-neutral-100">MCP servers</h2>
      <p class="mb-3 text-sm text-gray-600 dark:text-neutral-400">
        Connect OAuth-gated MCP servers in <a href="/settings/mcp" class="underline hover:text-gray-900 dark:hover:text-neutral-200">Settings → MCP</a>.
      </p>
    </section>

    <section class="rounded border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/30">
      <h2 class="mb-1 text-sm font-medium text-red-900 dark:text-red-200">Delete account</h2>
      <p class="mb-3 text-sm text-red-800 dark:text-red-300">
        Permanently delete your account and all data. This cannot be undone.
      </p>
      <button
        type="button"
        class="rounded border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:border-red-500 hover:bg-red-100 dark:border-red-800 dark:bg-neutral-900 dark:text-red-300 dark:hover:bg-red-950"
        onclick={() => { showDeleteDialog = true; }}
      >
        Delete account…
      </button>
    </section>
  </main>

  {#if showDeleteDialog}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 z-100 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      tabindex="-1"
      onclick={closeDeleteDialog}
      onkeydown={(e) => { if (e.key === 'Escape') closeDeleteDialog(); }}
    >
      <div
        class="w-full max-w-sm rounded border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
        role="document"
      >
        <h2 id="delete-dialog-title" class="text-base font-medium text-red-700 dark:text-red-300">Delete account</h2>
        <p class="mt-2 text-sm text-gray-600 dark:text-neutral-400">
          Type <code class="rounded bg-gray-100 px-1 font-mono dark:bg-neutral-800">{CONFIRM_PHRASE}</code> to confirm.
        </p>

        <label class="mt-3 block">
          <span class="mb-1 block text-xs uppercase tracking-wide text-gray-500 dark:text-neutral-500">Password</span>
          <input
            type="password"
            bind:value={password}
            class="w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
          />
        </label>

        <label class="mt-3 block">
          <span class="mb-1 block text-xs uppercase tracking-wide text-gray-500 dark:text-neutral-500">Confirm</span>
          <input
            type="text"
            bind:value={confirmText}
            placeholder={CONFIRM_PHRASE}
            class="w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
          />
        </label>

        {#if error}
          <div class="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </div>
        {/if}

        <div class="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            class="rounded border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            onclick={closeDeleteDialog}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded border border-red-700 bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            onclick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting…' : 'Delete account'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
