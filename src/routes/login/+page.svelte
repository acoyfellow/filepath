<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { signIn } from '$lib/auth-client';
  import Nav from '$lib/components/Nav.svelte';
  
  let email = $state('');
  let password = $state('');
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  
  onMount(() => {
    // If user is already authenticated, redirect to dashboard
    if (page.data.user) {
      goto('/dashboard');
    }
  });
  
  async function handleSubmit(e: Event) {
    e.preventDefault();
    
    if (!email.trim()) {
      error = 'Email is required';
      return;
    }
    
    if (!password.trim()) {
      error = 'Password is required';
      return;
    }
    
    isLoading = true;
    error = null;
    
    try {
      const result = await signIn.email({ email, password });
      
      if (result.error) {
        error = result.error.message || 'Invalid email or password';
        return;
      }
      
      goto('/dashboard');
    } catch (err) {
      error = 'An unexpected error occurred. Please try again.';
      console.error(err);
    } finally {
      isLoading = false;
    }
  }
</script>

<svelte:head>
  <title>Login - myfilepath.com</title>
</svelte:head>

<div class="min-h-screen bg-neutral-950 text-neutral-300 font-sans">
  <Nav variant="centered" />

  <main class="max-w-sm mx-auto px-6 py-20">
    <div class="text-center mb-8">
      <svg width="48" height="48" viewBox="0 0 339 339" fill="none" xmlns="http://www.w3.org/2000/svg" class="mx-auto mb-4">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M119.261 35C128.462 35.0001 137.256 38.8378 143.569 45.6083L160.108 63.3453C166.421 70.1159 175.215 73.9536 184.416 73.9536H298.583C317.039 73.9536 332 89.0902 332 107.762V270.191C332 288.863 317.039 304 298.583 304H41.417C22.9613 304 8 288.863 8 270.191V68.8087C8.0001 50.1368 22.9614 35 41.417 35H119.261ZM169.23 219.37V259.415H291.318V219.37H169.23ZM50.7361 111.182L110.398 171.838L51.027 226.311L79.9846 258.994L169.77 173.606L82.022 81.2961L50.7361 111.182Z" fill="currentColor"/>
      </svg>
      <h1 class="text-neutral-100 text-lg font-medium">Sign in to myfilepath.com</h1>
    </div>

    {#if error}
      <div class="bg-red-900/50 border border-red-800 text-red-200 px-4 py-3 rounded mb-4 text-sm">
        {error}
      </div>
    {/if}

    <form class="space-y-4" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      <div>
        <label for="email" class="block text-sm text-neutral-500 mb-2">Email</label>
        <input 
          id="email"
          type="email" 
          bind:value={email}
          class="w-full bg-neutral-900 border border-neutral-800 rounded px-4 py-3 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
          placeholder="you@example.com"
          required
          disabled={isLoading}
        />
      </div>
      
      <div>
        <label for="password" class="block text-sm text-neutral-500 mb-2">Password</label>
        <input 
          id="password"
          type="password" 
          bind:value={password}
          class="w-full bg-neutral-900 border border-neutral-800 rounded px-4 py-3 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
          placeholder="********"
          autocomplete="current-password"
          required
          disabled={isLoading}
        />
      </div>

      <button 
        type="submit"
        class="w-full bg-neutral-100 text-neutral-950 rounded px-4 py-3 font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={isLoading}
      >
        {isLoading ? 'Signing in...' : 'Sign in'}
      </button>
    </form>

    <div class="mt-6 text-center text-sm">
      <span class="text-neutral-500">Don't have an account?</span>
      <a href="/signup" class="text-neutral-100 hover:underline ml-1">Sign up</a>
    </div>

    <div class="mt-4 text-center text-sm">
      <a href="/forgot-password" class="text-neutral-500 hover:text-neutral-300 transition-colors">Forgot password?</a>
    </div>

    <div class="mt-8 pt-8 border-t border-neutral-800 text-center text-xs text-neutral-600">
      Humans sign in here. Agents use API keys.
    </div>
  </main>

  <footer class="border-t border-neutral-800 px-6 py-6 text-center text-neutral-600 text-xs font-mono">
    myfilepath.com
  </footer>
</div>
