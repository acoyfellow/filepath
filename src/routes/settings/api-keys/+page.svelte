<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { apiKeysApi } from '$lib/auth-client';
  type ApiKeyData = {
    id: string;
    name: string | null;
    start: string | null;
    prefix: string | null;
    createdAt: Date;
    updatedAt: Date;
    expiresAt: Date | null;
    metadata: Record<string, unknown> | null;
    permissions: Record<string, string[]> | null;
  };
  type ApiKeyRecord = Omit<ApiKeyData, 'createdAt' | 'updatedAt' | 'expiresAt'> & {
    createdAt: string | Date;
    updatedAt: string | Date;
    expiresAt: string | Date | null;
  };

  let apiKeys = $state<ApiKeyData[]>([]);
  let isLoading = $state(true);
  let showCreateDialog = $state(false);
  let newKeyName = $state('');
  let newKeySecrets = $state('');
  let createdKey = $state<string | null>(null);
  let error = $state<string | null>(null);

  onMount(async () => {
    if (!page.data.user) {
      goto('/');
      return;
    }
    await loadApiKeys();
  });

  async function loadApiKeys() {
    isLoading = true;
    try {
      const result = await apiKeysApi.list();
      if (result.data) {
        apiKeys = result.data.apiKeys.map((key: ApiKeyRecord) => ({
          ...key,
          createdAt: new Date(key.createdAt),
          updatedAt: new Date(key.updatedAt),
          expiresAt: key.expiresAt ? new Date(key.expiresAt) : null
        }));
      }
    } catch (e) {
      error = 'Failed to load API keys';
    } finally {
      isLoading = false;
    }
  }

  async function createApiKey() {
    if (!newKeyName.trim()) {
      error = 'Name is required';
      return;
    }

    try {
      const secretsObj: Record<string, string> = {};
      if (newKeySecrets.trim()) {
        for (const line of newKeySecrets.split('\n')) {
          const [key, ...valueParts] = line.split('=');
          if (key && valueParts.length > 0) {
            secretsObj[key.trim()] = valueParts.join('=').trim();
          }
        }
      }

      const result = await apiKeysApi.create({
        name: newKeyName.trim(),
        prefix: 'mfp_',
        metadata: {
          agentName: newKeyName.trim(),
          shell: 'bash',
          createdVia: 'web-ui'
        }
      });

      if (result.data?.key && result.data?.id) {
        const secretsResponse = await fetch('/api/user/api-keys/secrets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keyId: result.data.id,
            secrets: secretsObj,
          }),
        });

        if (!secretsResponse.ok) {
          const errData = await secretsResponse.json().catch(() => null) as { message?: string } | null;
          error = errData?.message || 'Failed to store encrypted secrets';
          return;
        }

        createdKey = result.data.key;
        await loadApiKeys();
        newKeyName = '';
        newKeySecrets = '';
      } else if (result.error) {
        error = result.error.message || 'Failed to create API key';
      } else {
        error = 'Failed to create API key';
      }
    } catch (e) {
      error = 'Failed to create API key';
    }
  }

  async function deleteApiKey(keyId: string) {
    if (!confirm('Are you sure you want to delete this API key?')) return;

    try {
      await apiKeysApi.delete({ keyId });
      await loadApiKeys();
    } catch (e) {
      error = 'Failed to delete API key';
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  function closeCreateDialog() {
    if (!createdKey) {
      showCreateDialog = false;
    }
  }

  function handleCreateDialogBackdropKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      closeCreateDialog();
    }
  }

  function stopCreateDialogKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeCreateDialog();
      return;
    }
    e.stopPropagation();
  }
</script>

<svelte:head>
  <title>API Keys - myfilepath.com</title>
</svelte:head>

<div class="min-h-screen font-sans bg-gray-50 text-gray-700 dark:bg-neutral-950 dark:text-neutral-300 transition-colors duration-200">
  <main class="max-w-3xl mx-auto px-6 py-12">
    <div class="flex items-center justify-between mb-10">
      <div>
        <h1 class="text-xl font-medium mb-1 text-gray-900 dark:text-neutral-100">API keys</h1>
        <p class="text-sm text-gray-500 dark:text-neutral-500">Manage access keys for your agents</p>
      </div>
      <div class="flex gap-3">
			<a href="/dashboard" class="px-4 py-2 text-sm border rounded transition-colors text-gray-600 border-gray-200 hover:border-gray-400 dark:text-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600">Back</a>
        <button
          onclick={() => { showCreateDialog = true; createdKey = null; error = null; }}
          class="px-4 py-2 text-sm font-medium bg-neutral-100 text-neutral-950 rounded hover:bg-white transition-colors cursor-pointer"
        >
          + create key
        </button>
      </div>
    </div>

    {#if error}
      <div class="bg-red-950/50 border border-red-800 rounded p-4 mb-6">
        <p class="text-red-400 text-sm">{error}</p>
        <button onclick={() => error = null} class="text-red-500 text-xs mt-1 hover:underline cursor-pointer">dismiss</button>
      </div>
    {/if}

    {#if isLoading}
      <div class="text-center py-16">
        <div class="w-6 h-6 border-2 rounded-full animate-spin mx-auto border-gray-300 border-t-gray-500 dark:border-neutral-700 dark:border-t-neutral-400"></div>
        <p class="mt-4 text-sm text-gray-500 dark:text-neutral-500">Loading…</p>
      </div>
    {:else if apiKeys.length === 0}
      <div class="border rounded p-12 text-center transition-colors duration-200 border-gray-200 dark:border-neutral-800">
        <p class="mb-1 text-gray-600 dark:text-neutral-400">No API keys yet</p>
        <p class="text-sm mb-6 text-gray-400 dark:text-neutral-600">Create an API key to give your agents access</p>
        <button
          onclick={() => { showCreateDialog = true; createdKey = null; }}
          class="px-4 py-2 text-sm font-medium bg-neutral-100 text-neutral-950 rounded hover:bg-white transition-colors cursor-pointer"
        >
          create your first key
        </button>
      </div>
    {:else}
      <div class="space-y-3">
        {#each apiKeys as key (key.id)}
          <div class="border rounded p-5 transition-colors duration-200 bg-gray-100 border-gray-200 dark:bg-neutral-900 dark:border-neutral-800">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-gray-900 dark:text-neutral-100">{key.name || 'Unnamed'}</p>
                <p class="font-mono text-xs mt-1 text-gray-500 dark:text-neutral-500">
                  {key.start || ''}{'•'.repeat(10)}
                </p>
                <p class="text-xs mt-1 text-gray-400 dark:text-neutral-600">
                  Created {new Date(key.createdAt).toLocaleDateString()}
                  {#if key.expiresAt}
                    · Expires {new Date(key.expiresAt).toLocaleDateString()}
                  {/if}
                </p>
              </div>
              <div class="flex items-center gap-3">
                {#if key.expiresAt}
                  <span class="px-2 py-1 text-xs font-mono rounded {key.expiresAt > new Date() ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400 border border-red-800'}">
                    {key.expiresAt > new Date() ? 'active' : 'expired'}
                  </span>
                {:else}
                  <span class="px-2 py-1 text-xs font-mono border rounded text-gray-500 border-gray-200 dark:text-neutral-500 dark:border-neutral-800">
                    no expiry
                  </span>
                {/if}
                <button
                  onclick={() => deleteApiKey(key.id)}
                  class="px-3 py-1 text-xs text-red-400 border border-red-900 rounded hover:bg-red-950 transition-colors cursor-pointer"
                >
                  delete
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </main>
</div>

<!-- Create Dialog -->
{#if showCreateDialog}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center"
    onclick={closeCreateDialog}
    onkeydown={handleCreateDialogBackdropKeydown}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="border rounded-lg p-6 max-w-lg w-full mx-4 transition-colors duration-200 bg-white border-gray-200 dark:bg-neutral-900 dark:border-neutral-800"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-api-key-title"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={stopCreateDialogKeydown}
    >
      <h2 class="text-lg font-medium mb-4 text-gray-900 dark:text-neutral-100" id="create-api-key-title">
        {createdKey ? 'Key created' : 'Create API key'}
      </h2>

      {#if createdKey}
        <div>
          <p class="text-sm mb-4 text-gray-500 dark:text-neutral-500">
            Copy this key now. You won’t be able to see it again.
          </p>
          <div class="border rounded p-4 font-mono text-sm break-all transition-colors duration-200 bg-gray-50 border-gray-200 text-gray-800 dark:bg-neutral-950 dark:border-neutral-800 dark:text-neutral-200">
            {createdKey}
          </div>
          <button
            onclick={() => copyToClipboard(createdKey!)}
            class="w-full mt-4 px-4 py-2 text-sm font-medium bg-neutral-100 text-neutral-950 rounded hover:bg-white transition-colors cursor-pointer"
          >
            copy to clipboard
          </button>
          <button
            onclick={() => { showCreateDialog = false; createdKey = null; }}
            class="w-full mt-2 px-4 py-2 text-sm border rounded transition-colors cursor-pointer text-gray-600 border-gray-200 hover:border-gray-400 dark:text-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
          >
            done
          </button>
        </div>
      {:else}
        <div class="space-y-4">
          <div>
            <label for="keyName" class="text-xs uppercase tracking-wide text-gray-500 dark:text-neutral-500">Agent name</label>
            <input
              id="keyName"
              bind:value={newKeyName}
              placeholder="my-coding-agent"
              class="w-full mt-1 px-3 py-2 border rounded text-sm focus:outline-none transition-colors duration-200 bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 focus:border-gray-400 dark:bg-neutral-950 dark:border-neutral-800 dark:text-neutral-200 dark:placeholder:text-neutral-700 dark:focus:border-neutral-600"
            />
          </div>
          <div>
            <label for="secrets" class="text-xs uppercase tracking-wide text-gray-500 dark:text-neutral-500">Environment secrets <span class="text-gray-400 dark:text-neutral-700">(optional)</span></label>
            <textarea
              id="secrets"
              bind:value={newKeySecrets}
              placeholder={"ANTHROPIC_API_KEY=sk-...\nGITHUB_TOKEN=ghp_..."}
              rows="4"
              class="w-full mt-1 px-3 py-2 border rounded text-sm font-mono focus:outline-none resize-none transition-colors duration-200 bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 focus:border-gray-400 dark:bg-neutral-950 dark:border-neutral-800 dark:text-neutral-200 dark:placeholder:text-neutral-700 dark:focus:border-neutral-600"
            ></textarea>
            <p class="text-xs mt-1 text-gray-400 dark:text-neutral-600">One per line: KEY=value</p>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button
            onclick={() => showCreateDialog = false}
            class="px-4 py-2 text-sm border rounded transition-colors cursor-pointer text-gray-600 border-gray-200 hover:border-gray-400 dark:text-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
          >
            cancel
          </button>
          <button
            onclick={createApiKey}
            class="px-4 py-2 text-sm font-medium bg-neutral-100 text-neutral-950 rounded hover:bg-white transition-colors cursor-pointer"
          >
            create key
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
