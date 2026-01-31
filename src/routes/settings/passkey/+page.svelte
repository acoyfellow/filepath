<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { authClient } from '$lib/auth-client';
  import { passkeyClient } from '@better-auth/passkey/client';
  
  let passkeys = $state<Array<{id: string, name: string, createdAt: Date}>>([]);
  let newPasskeyName = $state('');
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let success = $state<string | null>(null);
  
  onMount(() => {
    // If user is not authenticated, redirect to signin
    if (!page.data.user) {
      goto('/signin');
      return;
    }
    
    // Load existing passkeys
    loadPasskeys();
  });
  
  async function loadPasskeys() {
    isLoading = true;
    error = null;
    
    try {
      const result = await authClient.passkey.listUserPasskeys();
      
      if (result.error) {
        error = result.error.message;
        isLoading = false;
        return;
      }
      
      passkeys = result.data?.map(p => ({
        id: p.id,
        name: p.name || 'Unnamed Passkey',
        createdAt: new Date(p.createdAt)
      })) || [];
      
      isLoading = false;
    } catch (err) {
      error = 'Failed to load passkeys';
      isLoading = false;
      console.error(err);
    }
  }
  
  async function addPasskey() {
    if (!newPasskeyName.trim()) {
      error = 'Passkey name is required';
      return;
    }
    
    isLoading = true;
    error = null;
    success = null;
    
    try {
      const result = await passkey.addPasskey({
        name: newPasskeyName,
        authenticatorAttachment: "platform"
      });
      
      if (result.error) {
        error = result.error.message;
        return;
      }
      
      success = 'Passkey added successfully!';
      newPasskeyName = '';
      
      // Reload passkeys
      await loadPasskeys();
    } catch (err) {
      error = 'Failed to add passkey';
      console.error(err);
    } finally {
      isLoading = false;
    }
  }
  
  async function removePasskey(id: string) {
    isLoading = true;
    error = null;
    success = null;
    
    try {
      const result = await passkey.deletePasskey({ id });
      
      if (result.error) {
        error = result.error.message;
        return;
      }
      
      success = 'Passkey removed successfully!';
      
      // Reload passkeys
      await loadPasskeys();
    } catch (err) {
      error = 'Failed to remove passkey';
      console.error(err);
    } finally {
      isLoading = false;
    }
  }
</script>

<svelte:head>
  <title>Passkey Settings - myfilepath.com</title>
</svelte:head>

<div class="min-h-screen bg-white">
  <!-- Header -->
  <header class="flex items-center justify-between p-4 border-b-4 border-black">
    <div class="flex items-center gap-4">
      <a href="/dashboard" class="px-4 py-2 text-xl font-black bg-black text-white border-4 border-black hover:bg-white hover:text-black">
        ← DASHBOARD
      </a>
    </div>
    
    <div class="flex items-center gap-2">
      <span class="px-3 py-2 font-mono text-sm border-4 border-black">{page.data.user?.email}</span>
    </div>
  </header>
  
  <!-- Main Content -->
  <main class="p-8 max-w-4xl mx-auto">
    <h1 class="text-3xl font-black mb-8">PASSKEY SETTINGS</h1>
    
    {#if error}
      <div class="bg-red-50 border-4 border-red-500 p-4 mb-6">
        <p class="text-red-700 font-bold">{error}</p>
      </div>
    {/if}
    
    {#if success}
      <div class="bg-green-50 border-4 border-green-500 p-4 mb-6">
        <p class="text-green-700 font-bold">{success}</p>
      </div>
    {/if}
    
    <div class="border-4 border-black p-6 mb-8">
      <h2 class="text-2xl font-black mb-4">ADD NEW PASSKEY</h2>
      <div class="mb-4">
        <label for="passkeyName" class="block text-sm font-bold mb-2">PASSKEY NAME</label>
        <input
          id="passkeyName"
          type="text"
          bind:value={newPasskeyName}
          class="w-full px-3 py-2 border-4 border-black focus:outline-none focus:ring-0"
          placeholder="e.g., My MacBook Touch ID"
        />
      </div>
      <button
        onclick={addPasskey}
        disabled={isLoading}
        class="px-6 py-3 font-black border-4 border-black bg-black text-white hover:bg-white hover:text-black disabled:opacity-50"
      >
        {isLoading ? 'ADDING PASSKEY...' : 'ADD PASSKEY'}
      </button>
    </div>
    
    <div class="border-4 border-black p-6">
      <h2 class="text-2xl font-black mb-4">YOUR PASSKEYS</h2>
      
      {#if isLoading && passkeys.length === 0}
        <div class="text-center py-8">
          <div class="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p class="mt-4 text-gray-600">Loading passkeys...</p>
        </div>
      {:else if passkeys.length === 0}
        <div class="text-center py-8">
          <p class="text-gray-600">No passkeys registered yet</p>
        </div>
      {:else}
        <div class="space-y-4">
          {#each passkeys as passkey (passkey.id)}
            <div class="flex items-center justify-between p-4 border-2 border-black">
              <div>
                <h3 class="font-black text-lg">{passkey.name}</h3>
                <p class="text-sm text-gray-600">Added: {passkey.createdAt.toLocaleDateString()}</p>
              </div>
              <button
                onclick={() => removePasskey(passkey.id)}
                disabled={isLoading}
                class="px-4 py-2 text-sm font-black border-2 border-black hover:bg-black hover:text-white disabled:opacity-50"
              >
                REMOVE
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
    
    <div class="mt-8 pt-8 border-t-4 border-black">
      <h2 class="text-2xl font-black mb-4">ABOUT PASSKEYS</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="border-4 border-black p-6">
          <h3 class="text-xl font-black mb-2">WHAT ARE PASSKEYS?</h3>
          <p class="text-gray-700">Passkeys are a replacement for passwords. They're more secure and easier to use, stored on your device and unlocked with biometrics.</p>
        </div>
        <div class="border-4 border-black p-6">
          <h3 class="text-xl font-black mb-2">SECURITY</h3>
          <p class="text-gray-700">Passkeys are phishing-resistant and can't be stolen in data breaches. They use industry-standard cryptography to keep your account secure.</p>
        </div>
      </div>
    </div>
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
  }
  
  :global(input) {
    border-radius: 0 !important;
  }
</style>
