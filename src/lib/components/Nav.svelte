<script lang="ts">
  import { signOut } from '$lib/auth-client';
  import { goto } from '$app/navigation';

  interface Props {
    current?: string | null;
    variant?: 'centered' | 'dashboard';
    email?: string | null;
  }
  
  let { current = null, variant = 'centered', email = null }: Props = $props();

  async function signOutUser() {
    try {
      await signOut();
      goto('/');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  }
</script>

{#if variant === 'dashboard'}
  <nav class="border-b border-neutral-800 px-6 py-3 bg-neutral-950/80 backdrop-blur-sm">
    <div class="max-w-6xl mx-auto flex items-center justify-between">
      <a href="/dashboard" class="flex items-center gap-2">
        <svg width="20" height="20" viewBox="0 0 339 339" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M119.261 35C128.462 35.0001 137.256 38.8378 143.569 45.6083L160.108 63.3453C166.421 70.1159 175.215 73.9536 184.416 73.9536H298.583C317.039 73.9536 332 89.0902 332 107.762V270.191C332 288.863 317.039 304 298.583 304H41.417C22.9613 304 8 288.863 8 270.191V68.8087C8.0001 50.1368 22.9614 35 41.417 35H119.261ZM169.23 219.37V259.415H291.318V219.37H169.23ZM50.7361 111.182L110.398 171.838L51.027 226.311L79.9846 258.994L169.77 173.606L82.022 81.2961L50.7361 111.182Z" fill="currentColor"/>
        </svg>
        <span class="text-neutral-100 font-medium text-sm">filepath</span>
      </a>
      <div class="flex items-center gap-5 text-sm">
        <a href="/settings/api-keys" class="text-neutral-400 hover:text-neutral-100 transition-colors" class:text-neutral-100={current === 'api-keys'}>keys</a>
        <a href="/settings/billing" class="text-neutral-400 hover:text-neutral-100 transition-colors" class:text-neutral-100={current === 'billing'}>billing</a>
        <a href="/settings/account" class="text-neutral-400 hover:text-neutral-100 transition-colors" class:text-neutral-100={current === 'account'}>account</a>
        {#if email}
          <span class="text-neutral-600 font-mono text-xs">{email}</span>
        {/if}
        <button
          onclick={signOutUser}
          class="text-neutral-500 hover:text-neutral-100 transition-colors cursor-pointer"
        >
          sign out
        </button>
      </div>
    </div>
  </nav>
{:else}
  <nav class="border-b border-neutral-800 px-6 py-4 relative z-10 bg-neutral-950/50 backdrop-blur-sm">
    <div class="flex items-center gap-2 justify-between max-w-2xl mx-auto">
      <a href="/" class="flex items-center gap-2">
        <svg width="24" height="24" viewBox="0 0 339 339" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M119.261 35C128.462 35.0001 137.256 38.8378 143.569 45.6083L160.108 63.3453C166.421 70.1159 175.215 73.9536 184.416 73.9536H298.583C317.039 73.9536 332 89.0902 332 107.762V270.191C332 288.863 317.039 304 298.583 304H41.417C22.9613 304 8 288.863 8 270.191V68.8087C8.0001 50.1368 22.9614 35 41.417 35H119.261ZM169.23 219.37V259.415H291.318V219.37H169.23ZM50.7361 111.182L110.398 171.838L51.027 226.311L79.9846 258.994L169.77 173.606L82.022 81.2961L50.7361 111.182Z" fill="currentColor"/>
        </svg>
        <span class="text-neutral-100 font-medium">filepath</span>
      </a>
      <div class="flex gap-6 text-sm">
        <a href="/docs" class="text-neutral-400 hover:text-neutral-100 transition-colors" class:text-neutral-100={current === 'docs'}>docs</a>
        <a href="/pricing" class="text-neutral-400 hover:text-neutral-100 transition-colors" class:text-neutral-100={current === 'pricing'}>pricing</a>
        <a href="/login" class="text-neutral-400 hover:text-neutral-100 transition-colors" class:text-neutral-100={current === 'login'}>login</a>
      </div>
    </div>
  </nav>
{/if}
