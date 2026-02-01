<script lang="ts">
  import { forgetPasswordEmailOTP } from '$lib/auth-client';
  import { X, Mail, ArrowLeft } from '@lucide/svelte';
  import Nav from '$lib/components/Nav.svelte';
  
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

<div class="min-h-screen bg-neutral-950 text-neutral-300 font-sans">
  <Nav variant="centered" />

  <main class="max-w-md mx-auto px-6 py-20">
    <div class="mb-8">
      <a href="/login" class="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-300 transition-colors">
        <ArrowLeft class="w-4 h-4" />
        Back to login
      </a>
    </div>

    <div class="text-center mb-8">
      <div class="w-12 h-12 bg-neutral-900 border border-neutral-800 rounded-lg flex items-center justify-center mx-auto mb-4">
        <Mail class="w-6 h-6 text-neutral-100" />
      </div>
      <h1 class="text-neutral-100 text-xl font-medium">Reset your password</h1>
      <p class="text-neutral-500 text-sm mt-2">
        Enter your email and we'll send you a one-time code
      </p>
    </div>

    {#if success}
      <div class="bg-green-900/30 border border-green-800 rounded-lg p-4 mb-6">
        <div class="flex gap-3">
          <div class="text-green-400 mt-0.5">✓</div>
          <div>
            <p class="text-green-200 text-sm font-medium">Check your email</p>
            <p class="text-green-300/70 text-sm mt-1">
              We've sent a one-time code to {email}. Use it to reset your password.
            </p>
          </div>
        </div>
      </div>
      
      <div class="text-center">
        <a href="/reset-password" class="inline-flex items-center gap-2 text-neutral-100 hover:underline">
          Enter the code
          <span class="text-neutral-500">→</span>
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
      
      <form class="space-y-4" on:submit|preventDefault={handleSubmit}>
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

        <button 
          type="submit"
          class="w-full bg-neutral-100 text-neutral-950 rounded px-4 py-3 font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          {isLoading ? 'Sending code...' : 'Send reset code'}
        </button>
      </form>

      <div class="mt-6 text-center text-sm">
        <span class="text-neutral-500">Remember your password?</span>
        <a href="/login" class="text-neutral-100 hover:underline ml-1">Sign in</a>
      </div>
    {/if}
  </main>

  <footer class="border-t border-neutral-800 px-6 py-6 text-center text-neutral-600 text-xs font-mono">
    myfilepath.com
  </footer>
</div>
