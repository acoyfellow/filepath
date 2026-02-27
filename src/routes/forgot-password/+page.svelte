<script lang="ts">
  import { browser } from '$app/environment';
  import { forgetPasswordEmailOTP } from '$lib/auth-client';
  import { X, Mail, ArrowLeft } from '@lucide/svelte';
  import Nav from '$lib/components/Nav.svelte';
  
  let dark = $state(browser && document.documentElement.classList.contains('dark'));
  if (browser) {
    const observer = new MutationObserver(() => {
      dark = document.documentElement.classList.contains('dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }

  let email = $state('');
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let success = $state(false);
  
  async function handleSubmit(e: Event) {
    e.preventDefault();
    
    if (!email.trim()) {
      error = 'Email is required';
      return;
    }
    
    isLoading = true;
    error = null;
    
    try {
      const result = await forgetPasswordEmailOTP({ email });
      
      if (result.error) {
        error = result.error.message || 'An error occurred';
        return;
      }
      
      success = true;
    } catch (err) {
      error = 'An unexpected error occurred. Please try again.';
      console.error(err);
    } finally {
      isLoading = false;
    }
  }
</script>

<svelte:head>
  <title>Reset Password - myfilepath.com</title>
  <meta name="description" content="Reset your myfilepath.com password" />
</svelte:head>

<div class="min-h-screen font-sans {dark ? 'bg-neutral-950 text-neutral-300' : 'bg-gray-50 text-gray-700'} transition-colors duration-200">
  <Nav variant="centered" />

  <main class="max-w-md mx-auto px-6 py-20">
    <div class="mb-8">
      <a href="/login" class="inline-flex items-center gap-2 text-sm transition-colors {dark ? 'text-neutral-500 hover:text-neutral-300' : 'text-gray-500 hover:text-gray-700'}">
        <ArrowLeft class="w-4 h-4" />
        Back to login
      </a>
    </div>

    <div class="text-center mb-8">
      <div class="w-12 h-12 border rounded-lg flex items-center justify-center mx-auto mb-4 transition-colors duration-200 {dark ? 'bg-neutral-900 border-neutral-800' : 'bg-gray-100 border-gray-200'}">
        <Mail class="w-6 h-6 {dark ? 'text-neutral-100' : 'text-gray-900'}" />
      </div>
      <h1 class="text-xl font-medium {dark ? 'text-neutral-100' : 'text-gray-900'}">Reset your password</h1>
      <p class="text-sm mt-2 {dark ? 'text-neutral-500' : 'text-gray-500'}">
        Enter your email and we'll send you a one-time code
      </p>
    </div>

    {#if success}
      <div class="bg-green-900/30 border border-green-800 rounded-lg p-4 mb-6">
        <div class="flex gap-3">
				<div class="text-green-400 mt-0.5">Success</div>
          <div>
            <p class="text-green-200 text-sm font-medium">Check your email</p>
            <p class="text-green-300/70 text-sm mt-1">
              We've sent a one-time code to {email}. Use it to reset your password.
            </p>
          </div>
        </div>
      </div>
      
      <div class="text-center">
        <a href="/reset-password" class="inline-flex items-center gap-2 hover:underline {dark ? 'text-neutral-100' : 'text-gray-900'}">
          Enter the code
				<span class="{dark ? 'text-neutral-500' : 'text-gray-500'}">to</span>
        </a>
      </div>
    {:else}
      {#if error}
        <div class="bg-red-900/30 border border-red-800 rounded-lg p-4 mb-6">
          <div class="flex gap-3">
            <X class="w-5 h-5 text-red-400 mt-0.5" />
            <p class="text-red-200 text-sm">{error}</p>
          </div>
        </div>
      {/if}
      
      <form class="space-y-4" onsubmit={(e) => { e.preventDefault(); handleSubmit(e); }}>
        <div>
          <label for="email" class="block text-sm mb-2 {dark ? 'text-neutral-500' : 'text-gray-500'}">Email</label>
          <input 
            id="email"
            type="email" 
            bind:value={email}
            class="w-full border rounded px-4 py-3 focus:outline-none transition-colors duration-200 {dark ? 'bg-neutral-900 border-neutral-800 text-neutral-100 placeholder-neutral-600 focus:border-neutral-600' : 'bg-gray-100 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400'}"
            placeholder="you@example.com"
            required
            disabled={isLoading}
          />
        </div>

        <button 
          type="submit"
          class="w-full bg-neutral-100 text-neutral-950 rounded px-4 py-3 font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          {isLoading ? 'Sending code...' : 'Send reset code'}
        </button>
      </form>

      <div class="mt-6 text-center text-sm">
        <span class="{dark ? 'text-neutral-500' : 'text-gray-500'}">Remember your password?</span>
        <a href="/login" class="ml-1 hover:underline {dark ? 'text-neutral-100' : 'text-gray-900'}">Sign in</a>
      </div>
    {/if}
  </main>

  <footer class="border-t px-6 py-6 text-center text-xs font-mono {dark ? 'border-neutral-800 text-neutral-600' : 'border-gray-200 text-gray-400'}">
    myfilepath.com
  </footer>
</div>
