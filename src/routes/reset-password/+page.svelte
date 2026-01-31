<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { resetPassword } from '$lib/auth-client';
  
  let password = $state('');
  let confirmPassword = $state('');
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let success = $state(false);
  
  // Get token from URL
  const token = $derived(page.url.searchParams.get('token'));
  
  async function handleSubmit() {
    if (!token) {
      error = 'Invalid reset link. Please request a new one.';
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
      const result = await resetPassword({ newPassword: password, token });
      
      if (result.error) {
        error = result.error.message || 'An error occurred';
        return;
      }
      
      success = true;
      // Redirect to login after 2 seconds
      setTimeout(() => goto('/signup'), 2000);
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
</svelte:head>

<div class="min-h-screen bg-white flex items-center justify-center p-4">
  <div class="w-full max-w-md border-4 border-black bg-white">
    <div class="p-8">
      <h1 class="text-3xl font-black mb-2 text-center">RESET PASSWORD</h1>
      <p class="text-gray-600 text-center mb-8">Enter your new password</p>
      
      {#if !token}
        <div class="bg-red-50 border-4 border-red-500 p-4 mb-6">
          <p class="text-red-700 font-bold">Invalid reset link. Please request a new one.</p>
        </div>
        <div class="text-center">
          <a href="/forgot-password" class="text-black font-bold underline">Request New Link</a>
        </div>
      {:else if success}
        <div class="bg-green-50 border-4 border-green-500 p-4 mb-6">
          <p class="text-green-700 font-bold">Password reset successfully! Redirecting to sign in...</p>
        </div>
      {:else}
        {#if error}
          <div class="bg-red-50 border-4 border-red-500 p-4 mb-6">
            <p class="text-red-700 font-bold">{error}</p>
          </div>
        {/if}
        
        <form onsubmit={handleSubmit}>
          <div class="mb-4">
            <label for="password" class="block text-sm font-bold mb-2">NEW PASSWORD</label>
            <input
              id="password"
              type="password"
              bind:value={password}
              class="w-full px-3 py-2 border-4 border-black focus:outline-none focus:ring-0"
              placeholder="••••••••"
              autocomplete="new-password"
            />
          </div>
          
          <div class="mb-6">
            <label for="confirmPassword" class="block text-sm font-bold mb-2">CONFIRM PASSWORD</label>
            <input
              id="confirmPassword"
              type="password"
              bind:value={confirmPassword}
              class="w-full px-3 py-2 border-4 border-black focus:outline-none focus:ring-0"
              placeholder="••••••••"
              autocomplete="new-password"
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            class="w-full px-4 py-3 font-black border-4 border-black bg-black text-white hover:bg-white hover:text-black disabled:opacity-50 mb-4"
          >
            {isLoading ? 'RESETTING...' : 'RESET PASSWORD'}
          </button>
        </form>
      {/if}
    </div>
  </div>
</div>

<style>
  :global(input) {
    border-radius: 0 !important;
  }
</style>
