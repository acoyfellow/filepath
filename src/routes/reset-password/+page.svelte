<script lang="ts">
  import { goto } from '$app/navigation';
  import { resetPasswordEmailOTP } from '$lib/auth-client';
  import SEO from '$lib/components/SEO.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import { X, ArrowLeft, Lock } from '@lucide/svelte';
  let email = $state('');
  let otp = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let success = $state(false);
  
  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!email.trim()) {
      error = 'Email is required';
      return;
    }
    
    if (!otp.trim()) {
      error = 'OTP code is required';
      return;
    }
    
    if (!password.trim()) {
      error = 'Password is required';
      return;
    }
    
    if (password.length < 6) {
      error = 'Password must be at least 6 characters';
      return;
    }
    
    if (password !== confirmPassword) {
      error = 'Passwords do not match';
      return;
    }
    
    isLoading = true;
    error = null;
    
    try {
      const result = await resetPasswordEmailOTP({ email, otp, password });
      
      if (result.error) {
        error = result.error.message || 'An error occurred';
        return;
      }
      
      success = true;
      // Redirect to login after 2 seconds
      setTimeout(() => goto('/login'), 2000);
    } catch (err) {
      error = 'An unexpected error occurred. Please try again.';
      console.error(err);
    } finally {
      isLoading = false;
    }
  }
</script>

<SEO
  title="Create new password | filepath"
  description="Set a new password for your filepath account using the reset code from email."
  keywords="filepath new password, reset password"
  path="/reset-password"
  type="website"
  section="Auth"
  tags="auth,password reset"
  noindex
/>

<div class="min-h-screen font-sans flex flex-col bg-gray-50 text-gray-700 dark:bg-neutral-950 dark:text-neutral-300 transition-colors duration-200">

  <main class="grow max-w-md mx-auto px-6 py-20">
    <div class="mb-8">
      <a href="/forgot-password" class="inline-flex items-center gap-2 text-sm transition-colors text-gray-500 hover:text-gray-700 dark:text-neutral-500 dark:hover:text-neutral-300">
        <ArrowLeft class="w-4 h-4" />
        Back
      </a>
    </div>

    <div class="text-center mb-8">
      <div class="w-12 h-12 border rounded-lg flex items-center justify-center mx-auto mb-4 transition-colors duration-200 bg-gray-100 border-gray-200 dark:bg-neutral-900 dark:border-neutral-800">
        <Lock class="w-6 h-6 text-gray-900 dark:text-neutral-100" />
      </div>
      <h1 class="text-xl font-medium text-gray-900 dark:text-neutral-100">Create new password</h1>
      <p class="text-sm mt-2 text-gray-500 dark:text-neutral-500">
        Enter the code from your email and your new password
      </p>
    </div>
      
      {#if success}
        <div class="bg-green-900/30 border border-green-800 rounded-lg p-4 mb-6">
          <div class="flex gap-3">
				<div class="text-green-400 mt-0.5">Success</div>
            <div>
              <p class="text-green-200 text-sm font-medium">Password reset successfully!</p>
              <p class="text-green-300/70 text-sm mt-1">
                Redirecting you to sign in...
              </p>
            </div>
          </div>
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
              autocomplete="email"
              disabled={isLoading}
            />
          </div>
          
          <div>
            <label for="otp" class="block text-sm mb-2 text-gray-500 dark:text-neutral-500">OTP Code</label>
            <input
              id="otp"
              type="text"
              bind:value={otp}
              class="w-full border rounded px-4 py-3 focus:outline-none transition-colors duration-200 bg-gray-100 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-400 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-600 dark:focus:border-neutral-600"
              placeholder="123456"
              autocomplete="off"
              disabled={isLoading}
            />
          </div>
          
          <div>
            <label for="password" class="block text-sm mb-2 text-gray-500 dark:text-neutral-500">New Password</label>
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
            {isLoading ? 'Resetting...' : 'Reset password'}
          </Button>
        </form>
        
        <div class="mt-6 text-center text-sm">
          <span class="text-gray-500 dark:text-neutral-500">Didn't receive the code?</span>
          <a href="/forgot-password" class="ml-1 hover:underline text-gray-900 dark:text-neutral-100">Resend code</a>
        </div>
      {/if}
  </main>

  <footer class="border-t px-6 py-6 text-center text-xs font-mono border-gray-200 text-gray-400 dark:border-neutral-800 dark:text-neutral-600">
    filepath
  </footer>
</div>
