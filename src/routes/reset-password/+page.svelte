<script lang="ts">
  import { goto } from '$app/navigation';
  import { resetPasswordEmailOTP } from '$lib/auth-client';
  import { X, ArrowLeft, Lock } from '@lucide/svelte';
  import Nav from '$lib/components/Nav.svelte';
  
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

<svelte:head>
  <title>Create New Password - myfilepath.com</title>
  <meta name="description" content="Create a new password for your myfilepath.com account" />
</svelte:head>

<div class="min-h-screen bg-neutral-950 text-neutral-300 font-sans flex flex-col">
  <Nav variant="centered" />

  <main class="flex-grow max-w-md mx-auto px-6 py-20">
    <div class="mb-8">
      <a href="/forgot-password" class="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-300 transition-colors">
        <ArrowLeft class="w-4 h-4" />
        Back
      </a>
    </div>

    <div class="text-center mb-8">
      <div class="w-12 h-12 bg-neutral-900 border border-neutral-800 rounded-lg flex items-center justify-center mx-auto mb-4">
        <Lock class="w-6 h-6 text-neutral-100" />
      </div>
      <h1 class="text-neutral-100 text-xl font-medium">Create new password</h1>
      <p class="text-neutral-500 text-sm mt-2">
        Enter the code from your email and your new password
      </p>
    </div>
      
      {#if success}
        <div class="bg-green-900/30 border border-green-800 rounded-lg p-4 mb-6">
          <div class="flex gap-3">
            <div class="text-green-400 mt-0.5">✓</div>
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
        
        <form class="space-y-4" on:submit|preventDefault={handleSubmit}>
          <div>
            <label for="email" class="block text-sm text-neutral-500 mb-2">Email</label>
            <input
              id="email"
              type="email"
              bind:value={email}
              class="w-full bg-neutral-900 border border-neutral-800 rounded px-4 py-3 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
              placeholder="you@example.com"
              autocomplete="email"
              disabled={isLoading}
            />
          </div>
          
          <div>
            <label for="otp" class="block text-sm text-neutral-500 mb-2">OTP Code</label>
            <input
              id="otp"
              type="text"
              bind:value={otp}
              class="w-full bg-neutral-900 border border-neutral-800 rounded px-4 py-3 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
              placeholder="123456"
              autocomplete="off"
              disabled={isLoading}
            />
          </div>
          
          <div>
            <label for="password" class="block text-sm text-neutral-500 mb-2">New Password</label>
            <input
              id="password"
              type="password"
              bind:value={password}
              class="w-full bg-neutral-900 border border-neutral-800 rounded px-4 py-3 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
              placeholder="••••••••"
              autocomplete="new-password"
              disabled={isLoading}
            />
          </div>
          
          <div>
            <label for="confirmPassword" class="block text-sm text-neutral-500 mb-2">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              bind:value={confirmPassword}
              class="w-full bg-neutral-900 border border-neutral-800 rounded px-4 py-3 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
              placeholder="••••••••"
              autocomplete="new-password"
              disabled={isLoading}
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            class="w-full bg-neutral-100 text-neutral-950 rounded px-4 py-3 font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Resetting...' : 'Reset password'}
          </button>
        </form>
        
        <div class="mt-6 text-center text-sm">
          <span class="text-neutral-500">Didn't receive the code?</span>
          <a href="/forgot-password" class="text-neutral-100 hover:underline ml-1">Resend code</a>
        </div>
      {/if}
  </main>

  <footer class="border-t border-neutral-800 px-6 py-6 text-center text-neutral-600 text-xs font-mono">
    myfilepath.com
  </footer>
</div>
