<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { signUp } from '$lib/auth-client';
  import SEO from '$lib/components/SEO.svelte';
  import Button from '$lib/components/ui/button/button.svelte';

  let email = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  
  onMount(() => {
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
    
    if (password !== confirmPassword) {
      error = 'Passwords do not match';
      return;
    }
    
    if (password.length < 6) {
      error = 'Password must be at least 6 characters';
      return;
    }
    
    isLoading = true;
    error = null;
    
    try {
      const result = await signUp.email({
        email,
        password,
        name: email.split('@')[0]
      });
      
      if (result.error) {
        error = result.error.message || 'An error occurred';
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

<SEO
  title="Create account | filepath"
  description="Create a filepath account to launch bounded background agents in your own workspace."
  keywords="filepath signup, create account"
  path="/signup"
  type="website"
  section="Auth"
  tags="auth,signup"
  noindex
/>

<div class="min-h-screen font-sans bg-gray-50 text-gray-700 dark:bg-neutral-950 dark:text-neutral-300 transition-colors duration-200">
  <main class="max-w-sm mx-auto px-6 py-20">
    <div class="text-center mb-8">
      <img src="/logo.svg" alt="filepath logo" width="48" class="mx-auto mb-4" style="height: auto;" />
      <h1 class="text-lg font-medium text-gray-900 dark:text-neutral-100">Create your account</h1>
    </div>

    {#if error}
      <div class="bg-red-900/50 border border-red-800 text-red-200 px-4 py-3 rounded mb-4 text-sm">
        {error}
      </div>
    {/if}

    <form class="space-y-4" onsubmit={(e) => { e.preventDefault(); handleSubmit(e); }}>
      <div>
        <label for="email" class="block text-sm mb-2 text-gray-500 dark:text-neutral-500">Email</label>
        <input 
          id="email"
          type="email" 
          bind:value={email}
          class="w-full border rounded px-4 py-3 focus:outline-none transition-colors duration-200 bg-gray-100 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-600 dark:focus:border-neutral-600"
          placeholder="you@example.com"
          autocomplete="email"
          disabled={isLoading}
        />
      </div>

      <div>
        <label for="password" class="block text-sm mb-2 text-gray-500 dark:text-neutral-500">Password</label>
        <input 
          id="password"
          type="password" 
          bind:value={password}
          class="w-full border rounded px-4 py-3 focus:outline-none transition-colors duration-200 bg-gray-100 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-600 dark:focus:border-neutral-600"
          placeholder="••••••••"
          autocomplete="new-password"
          disabled={isLoading}
        />
      </div>

      <div>
        <label for="confirmPassword" class="block text-sm mb-2 text-gray-500 dark:text-neutral-500">Confirm Password</label>
        <input 
          id="confirmPassword"
          type="password" 
          bind:value={confirmPassword}
          class="w-full border rounded px-4 py-3 focus:outline-none transition-colors duration-200 bg-gray-100 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-600 dark:focus:border-neutral-600"
          placeholder="••••••••"
          autocomplete="new-password"
          disabled={isLoading}
        />
      </div>

      <Button type="submit" class="w-full" disabled={isLoading}>
        {isLoading ? 'Creating account...' : 'Create account'}
      </Button>
    </form>

    <div class="mt-6 text-center text-sm">
      <span class="text-gray-500 dark:text-neutral-500">Already have an account?</span>
      <a href="/login" class="ml-1 hover:underline text-gray-900 dark:text-neutral-100">Sign in</a>
    </div>
  </main>

  <footer class="border-t px-6 py-6 text-center text-xs font-mono border-gray-200 text-gray-400 dark:border-neutral-800 dark:text-neutral-600">
    filepath
  </footer>
</div>
