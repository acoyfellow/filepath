<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { signIn } from '$lib/auth-client';
  import SEO from '$lib/components/SEO.svelte';
  import Button from '$lib/components/ui/button/button.svelte';

  const redirectTo = $derived.by(() => {
    const r = page.url.searchParams.get('redirect');
    if (!r || !r.startsWith('/')) return '/dashboard';
    return r;
  });
  let email = $state('');
  let password = $state('');
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  
  onMount(() => {
    if (page.data.user) {
      goto(redirectTo);
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
      
      goto(redirectTo);
    } catch (err) {
      error = 'An unexpected error occurred. Please try again.';
      console.error(err);
    } finally {
      isLoading = false;
    }
  }
</script>

<SEO
  title="Sign in | filepath"
  description="Sign in to your filepath account to manage workspaces and bounded background agents."
  keywords="filepath sign in, login"
  path="/login"
  type="website"
  section="Auth"
  tags="auth,login"
  noindex
/>

<div class="min-h-screen font-sans bg-gray-50 text-gray-700 dark:bg-neutral-950 dark:text-neutral-300 transition-colors duration-200">
  <main class="max-w-sm mx-auto px-6 py-20">
    <div class="text-center mb-8">
      <img src="/logo.svg" alt="filepath logo" width="48" class="mx-auto mb-4" style="height: auto;" />
      <h1 class="text-lg font-medium text-gray-900 dark:text-neutral-100">Sign in to filepath</h1>
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
          required
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
          placeholder="********"
          autocomplete="current-password"
          required
          disabled={isLoading}
        />
      </div>

      <Button type="submit" variant="accentPill" class="w-full" disabled={isLoading}>
        {isLoading ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>

    <div class="mt-6 text-center text-sm">
      <span class="text-gray-500 dark:text-neutral-500">Don't have an account?</span>
      <a href="/signup" class="ml-1 hover:underline text-gray-900 dark:text-neutral-100">Sign up</a>
    </div>

    <div class="mt-4 text-center text-sm">
      <a href="/forgot-password" class="transition-colors text-gray-500 hover:text-gray-700 dark:text-neutral-500 dark:hover:text-neutral-300">Forgot password?</a>
    </div>

    <div class="mt-8 pt-8 border-t text-center text-xs border-gray-200 text-gray-400 dark:border-neutral-800 dark:text-neutral-600">
      Humans sign in here. Agents use API keys.
    </div>
  </main>

  <footer class="border-t px-6 py-6 text-center text-xs font-mono border-gray-200 text-gray-400 dark:border-neutral-800 dark:text-neutral-600">
    filepath
  </footer>
</div>
