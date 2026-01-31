<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  
  onMount(() => {
    // If user is authenticated, redirect to dashboard
    if (page.data.user) {
      goto('/dashboard');
    }
  });
</script>

<svelte:head>
  <title>myfilepath.com - Terminal for AI Agents</title>
</svelte:head>

<div class="min-h-screen bg-white flex flex-col">
  <!-- Hero Section -->
  <div class="flex-1 flex flex-col items-center justify-center p-8 text-center">
    <h1 class="text-5xl md:text-7xl font-black mb-6 bg-black text-white px-6 py-3 inline-block">
      myfilepath.com
    </h1>
    <p class="text-xl md:text-2xl text-gray-700 max-w-2xl mb-10">
      The platform for AI agents. Secure terminal sandboxes with passkey authentication and prepaid billing.
    </p>
    
    <div class="flex flex-col sm:flex-row gap-4 mb-16">
      {#if page.data.user}
        <button 
          onclick={() => goto('/dashboard')}
          class="px-8 py-4 text-xl font-black border-4 border-black bg-black text-white hover:bg-white hover:text-black"
        >
          GO TO DASHBOARD
        </button>
      {:else}
        <button 
          onclick={() => goto('/signup')}
          class="px-8 py-4 text-xl font-black border-4 border-black bg-black text-white hover:bg-white hover:text-black"
        >
          SIGN UP NOW
        </button>
        <button 
          onclick={() => goto('/signup')}
          class="px-8 py-4 text-xl font-black border-4 border-black hover:bg-black hover:text-white"
        >
          SIGN IN
        </button>
      {/if}
    </div>
    
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl w-full">
      <div class="border-4 border-black p-6">
        <h3 class="text-2xl font-black mb-3">PASSKEY AUTH</h3>
        <p class="text-gray-700">Secure, passwordless authentication with FIDO2 passkeys as primary method.</p>
      </div>
      <div class="border-4 border-black p-6">
        <h3 class="text-2xl font-black mb-3">TERMINAL SANDBOXES</h3>
        <p class="text-gray-700">Isolated Linux environments for AI agents with full terminal access.</p>
      </div>
      <div class="border-4 border-black p-6">
        <h3 class="text-2xl font-black mb-3">PREPAID BILLING</h3>
        <p class="text-gray-700">$0.01/minute usage with prepaid credits and budget caps for API keys.</p>
      </div>
    </div>
  </div>
  
  <!-- Footer -->
  <footer class="p-8 border-t-4 border-black text-center text-gray-600">
    <p>© 2026 myfilepath.com - Secure terminal platform for AI agents</p>
  </footer>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    overflow-x: hidden;
  }
</style>