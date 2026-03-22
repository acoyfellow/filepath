<script lang="ts">
  import { forgetPasswordEmailOTP } from '$lib/auth-client';
  import SEO from '$lib/components/SEO.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import { X, Mail, ArrowLeft } from '@lucide/svelte';
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

<SEO
  title="Reset password | filepath"
  description="Request a password reset code for your filepath account."
  keywords="filepath reset password"
  path="/forgot-password"
  type="website"
  section="Auth"
  tags="auth,password reset"
  noindex
/>

<div class="min-h-screen font-sans bg-gray-50 text-gray-700 dark:bg-neutral-950 dark:text-neutral-300 transition-colors duration-200">
  <main class="max-w-md mx-auto px-6 py-20">
    <div class="mb-8">
      <a href="/login" class="inline-flex items-center gap-2 text-sm transition-colors text-gray-500 hover:text-gray-700 dark:text-neutral-500 dark:hover:text-neutral-300">
        <ArrowLeft class="w-4 h-4" />
        Back to login
      </a>
    </div>

    <div class="text-center mb-8">
      <div class="w-12 h-12 border rounded-lg flex items-center justify-center mx-auto mb-4 transition-colors duration-200 bg-gray-100 border-gray-200 dark:bg-neutral-900 dark:border-neutral-800">
        <Mail class="w-6 h-6 text-gray-900 dark:text-neutral-100" />
      </div>
      <h1 class="text-xl font-medium text-gray-900 dark:text-neutral-100">Reset your password</h1>
      <p class="text-sm mt-2 text-gray-500 dark:text-neutral-500">
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
        <a href="/reset-password" class="inline-flex items-center gap-2 hover:underline text-gray-900 dark:text-neutral-100">
          Enter the code
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

        <Button type="submit" class="w-full" disabled={isLoading}>
          {isLoading ? 'Sending code...' : 'Send reset code'}
        </Button>
      </form>

      <div class="mt-6 text-center text-sm">
        <span class="text-gray-500 dark:text-neutral-500">Remember your password?</span>
        <a href="/login" class="ml-1 hover:underline text-gray-900 dark:text-neutral-100">Sign in</a>
      </div>
    {/if}
  </main>

  <footer class="border-t px-6 py-6 text-center text-xs font-mono border-gray-200 text-gray-400 dark:border-neutral-800 dark:text-neutral-600">
    filepath
  </footer>
</div>
