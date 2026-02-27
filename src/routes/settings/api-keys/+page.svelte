<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { authClient } from '$lib/auth-client';
  import Nav from '$lib/components/Nav.svelte';

  let dark = $state(browser && document.documentElement.classList.contains('dark'));
  if (browser) {
    const observer = new MutationObserver(() => {
      dark = document.documentElement.classList.contains('dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }

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
      const result = await authClient.apiKey.list();
      if (result.data) {
        apiKeys = result.data.apiKeys.map(key => ({
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

      const result = await authClient.apiKey.create({
        name: newKeyName.trim(),
        prefix: 'mfp_',
        metadata: {
          agentName: newKeyName.trim(),
          secrets: secretsObj,
          shell: 'bash',
          createdVia: 'web-ui'
        }
      });

      if (result.data?.key) {
        createdKey = result.data.key;
        await loadApiKeys();
        newKeyName = '';
        newKeySecrets = '';
      } else if (result.error) {
        error = result.error.message || 'Failed to create API key';
      }
    } catch (e) {
      error = 'Failed to create API key';
    }
  }

  async function deleteApiKey(keyId: string) {
    if (!confirm('Are you sure you want to delete this API key?')) return;

    try {
      await authClient.apiKey.delete({ keyId });
      await loadApiKeys();
    } catch (e) {
      error = 'Failed to delete API key';
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }
</script>

<svelte:head>
  <title>API Keys - myfilepath.com</title>
</svelte:head>

<div class="min-h-screen font-sans {dark ? 'bg-neutral-950 text-neutral-300' : 'bg-gray-50 text-gray-700'} transition-colors duration-200">
  <Nav variant="dashboard" current="api-keys" email={page.data.user?.email} />

  <main class="max-w-3xl mx-auto px-6 py-12">
    <div class="flex items-center justify-between mb-10">
      <div>
        <h1 class="text-xl font-medium mb-1 {dark ? 'text-neutral-100' : 'text-gray-900'}">API keys</h1>
        <p class="text-sm {dark ? 'text-neutral-500' : 'text-gray-500'}">Manage access keys for your agents</p>
      </div>
      <div class="flex gap-3">
			<a href="/dashboard" class="px-4 py-2 text-sm border rounded transition-colors {dark ? 'text-neutral-400 border-neutral-800 hover:border-neutral-600' : 'text-gray-600 border-gray-200 hover:border-gray-400'}">Back</a>
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
        <div class="w-6 h-6 border-2 rounded-full animate-spin mx-auto {dark ? 'border-neutral-700 border-t-neutral-400' : 'border-gray-300 border-t-gray-500'}"></div>
        <p class="mt-4 text-sm {dark ? 'text-neutral-500' : 'text-gray-500'}">Loading…</p>
      </div>
    {:else if apiKeys.length === 0}
      <div class="border rounded p-12 text-center transition-colors duration-200 {dark ? 'border-neutral-800' : 'border-gray-200'}">
        <p class="mb-1 {dark ? 'text-neutral-400' : 'text-gray-600'}">No API keys yet</p>
        <p class="text-sm mb-6 {dark ? 'text-neutral-600' : 'text-gray-400'}">Create an API key to give your agents access</p>
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
          <div class="border rounded p-5 transition-colors duration-200 {dark ? 'bg-neutral-900 border-neutral-800' : 'bg-gray-100 border-gray-200'}">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium {dark ? 'text-neutral-100' : 'text-gray-900'}">{key.name || 'Unnamed'}</p>
                <p class="font-mono text-xs mt-1 {dark ? 'text-neutral-500' : 'text-gray-500'}">
                  {key.start || ''}{'•'.repeat(10)}
                </p>
                <p class="text-xs mt-1 {dark ? 'text-neutral-600' : 'text-gray-400'}">
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
                  <span class="px-2 py-1 text-xs font-mono border rounded {dark ? 'text-neutral-500 border-neutral-800' : 'text-gray-500 border-gray-200'}">
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
  <div class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center" onclick={() => { if (!createdKey) showCreateDialog = false; }}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="border rounded-lg p-6 max-w-lg w-full mx-4 transition-colors duration-200 {dark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'}" onclick={(e) => e.stopPropagation()}>
      <h2 class="text-lg font-medium mb-4 {dark ? 'text-neutral-100' : 'text-gray-900'}">
        {createdKey ? 'Key created' : 'Create API key'}
      </h2>

      {#if createdKey}
        <div>
          <p class="text-sm mb-4 {dark ? 'text-neutral-500' : 'text-gray-500'}">
            Copy this key now. You won’t be able to see it again.
          </p>
          <div class="border rounded p-4 font-mono text-sm break-all transition-colors duration-200 {dark ? 'bg-neutral-950 border-neutral-800 text-neutral-200' : 'bg-gray-50 border-gray-200 text-gray-800'}">
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
            class="w-full mt-2 px-4 py-2 text-sm border rounded transition-colors cursor-pointer {dark ? 'text-neutral-400 border-neutral-800 hover:border-neutral-600' : 'text-gray-600 border-gray-200 hover:border-gray-400'}"
          >
            done
          </button>
        </div>
      {:else}
        <div class="space-y-4">
          <div>
            <label for="keyName" class="text-xs uppercase tracking-wide {dark ? 'text-neutral-500' : 'text-gray-500'}">Agent name</label>
            <input
              id="keyName"
              bind:value={newKeyName}
              placeholder="my-coding-agent"
              class="w-full mt-1 px-3 py-2 border rounded text-sm focus:outline-none transition-colors duration-200 {dark ? 'bg-neutral-950 border-neutral-800 text-neutral-200 placeholder:text-neutral-700 focus:border-neutral-600' : 'bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 focus:border-gray-400'}"
            />
          </div>
          <div>
            <label for="secrets" class="text-xs uppercase tracking-wide {dark ? 'text-neutral-500' : 'text-gray-500'}">Environment secrets <span class="{dark ? 'text-neutral-700' : 'text-gray-400'}">(optional)</span></label>
            <textarea
              id="secrets"
              bind:value={newKeySecrets}
              placeholder={"ANTHROPIC_API_KEY=sk-...\nGITHUB_TOKEN=ghp_..."}
              rows="4"
              class="w-full mt-1 px-3 py-2 border rounded text-sm font-mono focus:outline-none resize-none transition-colors duration-200 {dark ? 'bg-neutral-950 border-neutral-800 text-neutral-200 placeholder:text-neutral-700 focus:border-neutral-600' : 'bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 focus:border-gray-400'}"
            ></textarea>
            <p class="text-xs mt-1 {dark ? 'text-neutral-600' : 'text-gray-400'}">One per line: KEY=value</p>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button
            onclick={() => showCreateDialog = false}
            class="px-4 py-2 text-sm border rounded transition-colors cursor-pointer {dark ? 'text-neutral-400 border-neutral-800 hover:border-neutral-600' : 'text-gray-600 border-gray-200 hover:border-gray-400'}"
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
