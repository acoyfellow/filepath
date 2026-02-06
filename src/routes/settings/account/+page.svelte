<script lang="ts">
  import { authClient } from '$lib/auth-client';
  import { goto } from '$app/navigation';
  import Nav from '$lib/components/Nav.svelte';

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

<div class="min-h-screen bg-neutral-950 text-neutral-300">
  <Nav variant="dashboard" current="account" />

  <main class="max-w-2xl mx-auto px-6 py-12">
    <div class="flex items-center justify-between mb-10">
      <div>
        <h1 class="text-neutral-100 text-xl font-medium mb-1">Account</h1>
        <p class="text-sm text-neutral-500">Manage your account settings</p>
      </div>
      <a href="/dashboard" class="px-4 py-2 text-sm text-neutral-400 border border-neutral-800 rounded hover:border-neutral-600 transition-colors">← back</a>
    </div>

    <section class="mb-10">
      <h2 class="text-neutral-500 text-xs uppercase tracking-wide mb-4">Account information</h2>
      <div class="bg-neutral-900 border border-neutral-800 rounded p-5">
        <p class="text-neutral-400 text-sm">Your account details are managed through your profile settings.</p>
      </div>
    </section>

    <section>
      <h2 class="text-red-400/80 text-xs uppercase tracking-wide mb-4">Danger zone</h2>
      <div class="bg-neutral-900 border border-red-900/50 rounded p-5">
        <p class="text-neutral-400 text-sm mb-4">
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
    <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-6 max-w-md w-full mx-4" onclick={(e) => e.stopPropagation()}>
      <h2 class="text-red-400 text-lg font-medium mb-2">Delete account</h2>
      <p class="text-neutral-400 text-sm mb-2">This will permanently delete:</p>
      <ul class="text-neutral-500 text-sm space-y-1 mb-6 ml-4">
        <li class="flex gap-2"><span class="text-neutral-600">•</span> All sessions and terminals</li>
        <li class="flex gap-2"><span class="text-neutral-600">•</span> All API keys</li>
        <li class="flex gap-2"><span class="text-neutral-600">•</span> Credit balance (non-refundable)</li>
        <li class="flex gap-2"><span class="text-neutral-600">•</span> Usage history</li>
      </ul>

      <div class="space-y-4">
        <div>
          <label for="password" class="text-xs text-neutral-500 uppercase tracking-wide">Password</label>
          <input
            id="password"
            type="password"
            placeholder="Enter your password"
            bind:value={password}
            class="w-full mt-1 px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-sm text-neutral-200 placeholder:text-neutral-700 focus:outline-none focus:border-neutral-600"
          />
        </div>

        <div>
          <label for="confirm" class="text-xs text-neutral-500 uppercase tracking-wide">Type "{CONFIRM_PHRASE}" to confirm</label>
          <input
            id="confirm"
            type="text"
            placeholder={CONFIRM_PHRASE}
            bind:value={confirmText}
            class="w-full mt-1 px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-sm text-neutral-200 placeholder:text-neutral-700 focus:outline-none focus:border-neutral-600"
          />
        </div>

        {#if error}
          <p class="text-red-400 text-sm">{error}</p>
        {/if}
      </div>

      <div class="flex justify-end gap-3 mt-6">
        <button
          onclick={() => showDeleteDialog = false}
          class="px-4 py-2 text-sm text-neutral-400 border border-neutral-800 rounded hover:border-neutral-600 transition-colors cursor-pointer"
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
