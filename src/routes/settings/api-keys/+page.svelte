<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { authClient } from '$lib/auth-client';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';

  type ApiKeyData = {
    id: string;
    name: string | null;
    start: string | null;
    prefix: string | null;
    createdAt: Date;
    updatedAt: Date;
    expiresAt: Date | null;
    budgetCap: number | null;
    metadata: Record<string, unknown> | null;
    permissions: Record<string, string[]> | null;
  };

  let apiKeys = $state<ApiKeyData[]>([]);
  let isLoading = $state(true);
  let showCreateDialog = $state(false);
  let newKeyName = $state('');
  let newKeySecrets = $state('');
  let newKeyBudgetCap = $state('');
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
        // Transform the API response to match our expected structure
        apiKeys = result.data.apiKeys.map(key => ({
          ...key,
          budgetCap: (key as any).budgetCap || null,
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
      // Parse secrets as key=value pairs
      const secretsObj: Record<string, string> = {};
      if (newKeySecrets.trim()) {
        for (const line of newKeySecrets.split('\n')) {
          const [key, ...valueParts] = line.split('=');
          if (key && valueParts.length > 0) {
            secretsObj[key.trim()] = valueParts.join('=').trim();
          }
        }
      }

      // Parse budget cap
      let budgetCap: number | undefined;
      if (newKeyBudgetCap.trim()) {
        const cap = parseInt(newKeyBudgetCap.trim(), 10);
        if (!isNaN(cap) && cap > 0) {
          budgetCap = cap;
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
        },
        ...(budgetCap !== undefined ? { budgetCap } : {})
      });

      if (result.data?.key) {
        createdKey = result.data.key;
          await loadApiKeys();
          newKeyName = '';
          newKeySecrets = '';
          newKeyBudgetCap = '';
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

<div class="min-h-screen bg-white p-8">
  <div class="max-w-4xl mx-auto">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-black">API Keys</h1>
        <p class="text-gray-600 mt-1">Manage API keys for your agents</p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" onclick={() => goto('/')}>← Back</Button>
        <Button onclick={() => { showCreateDialog = true; createdKey = null; error = null; }}>
          + Create API Key
        </Button>
      </div>
    </div>

    {#if error}
      <div class="bg-red-50 border-4 border-red-500 p-4 mb-6">
        <p class="text-red-700 font-bold">{error}</p>
        <button onclick={() => error = null} class="text-red-500 underline text-sm">Dismiss</button>
      </div>
    {/if}

    {#if isLoading}
      <div class="text-center py-12">
        <div class="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="mt-4 text-gray-600">Loading...</p>
      </div>
    {:else if apiKeys.length === 0}
      <Card.Root class="border-4 border-black">
        <Card.Content class="py-12 text-center">
          <p class="text-xl font-bold mb-2">No API keys yet</p>
          <p class="text-gray-600 mb-6">Create an API key to give your agents access</p>
          <Button onclick={() => { showCreateDialog = true; createdKey = null; }}>Create your first API key</Button>
        </Card.Content>
      </Card.Root>
    {:else}
      <div class="space-y-4">
        {#each apiKeys as key (key.id)}
          <Card.Root class="border-4 border-black">
            <Card.Content class="py-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-bold text-lg">{key.name || 'Unnamed'}</p>
                  <p class="font-mono text-sm text-gray-500">
                    {key.prefix || ''}{key.start || ''}{'•'.repeat(10)}
                  </p>
                  <p class="text-xs text-gray-400 mt-1">
                    Created {new Date(key.createdAt).toLocaleDateString()}
                    {#if key.expiresAt}
                      · Expires {new Date(key.expiresAt).toLocaleDateString()}
                    {/if}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  {#if key.expiresAt}
                    <span class="px-2 py-1 text-xs font-bold {key.expiresAt > new Date() ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                      {key.expiresAt > new Date() ? 'Active' : 'Expired'}
                    </span>
                  {:else}
                    <span class="px-2 py-1 text-xs font-bold bg-blue-100 text-blue-700">
                      No expiry
                    </span>
                  {/if}
                  <Button variant="destructive" size="sm" onclick={() => deleteApiKey(key.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            </Card.Content>
          </Card.Root>
        {/each}
      </div>
    {/if}
  </div>
</div>

<Dialog.Root bind:open={showCreateDialog}>
  <Dialog.Content class="border-4 border-black max-w-lg">
    <Dialog.Header>
      <Dialog.Title class="text-2xl font-black">
        {createdKey ? 'API Key Created!' : 'Create API Key'}
      </Dialog.Title>
    </Dialog.Header>

    {#if createdKey}
      <div class="py-4">
        <p class="text-sm text-gray-600 mb-4">
          Copy this key now. You won't be able to see it again!
        </p>
        <div class="bg-black text-white p-4 font-mono text-sm break-all">
          {createdKey}
        </div>
        <Button class="w-full mt-4" onclick={() => copyToClipboard(createdKey!)}>
          Copy to Clipboard
        </Button>
        <Button variant="outline" class="w-full mt-2" onclick={() => { showCreateDialog = false; createdKey = null; }}>
          Done
        </Button>
      </div>
    {:else}
      <div class="py-4 space-y-4">
        <div>
          <Label for="keyName">Agent Name</Label>
          <Input
            id="keyName"
            bind:value={newKeyName}
            placeholder="my-coding-agent"
            class="border-2 border-black mt-1"
          />
        </div>
        <div>
          <Label for="secrets">Environment Secrets (optional)</Label>
          <textarea
            id="secrets"
            bind:value={newKeySecrets}
            placeholder="ANTHROPIC_API_KEY=sk-...&#10;GITHUB_TOKEN=ghp_..."
            rows="4"
            class="w-full border-2 border-black p-2 font-mono text-sm mt-1"
          ></textarea>
          <p class="text-xs text-gray-500 mt-1">One per line: KEY=value</p>
        </div>
        <div>
          <Label for="budgetCap">Budget Cap (optional, credits)</Label>
          <Input
            id="budgetCap"
            type="number"
            bind:value={newKeyBudgetCap}
            placeholder="e.g., 10000"
            class="border-2 border-black mt-1"
          />
          <p class="text-xs text-gray-500 mt-1">Maximum credits this key can use</p>
        </div>
      </div>
      <Dialog.Footer>
        <Button variant="outline" onclick={() => showCreateDialog = false}>Cancel</Button>
        <Button onclick={createApiKey}>Create Key</Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>
