<script lang="ts">
  import { goto } from '$app/navigation';
  import { resetPasswordEmailOTP } from '$lib/auth-client';
  
  let email = $state('');
  let otp = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let success = $state(false);
  
  async function handleSubmit() {
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
      <p class="text-gray-600 text-center mb-8">Enter the OTP code sent to your email and your new password</p>
      
      {#if success}
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
            <label for="email" class="block text-sm font-bold mb-2">EMAIL</label>
            <input
              id="email"
              type="email"
              bind:value={email}
              class="w-full px-3 py-2 border-4 border-black focus:outline-none focus:ring-0"
              placeholder="your@email.com"
              autocomplete="email"
            />
          </div>
          
          <div class="mb-4">
            <label for="otp" class="block text-sm font-bold mb-2">OTP CODE</label>
            <input
              id="otp"
              type="text"
              bind:value={otp}
              class="w-full px-3 py-2 border-4 border-black focus:outline-none focus:ring-0"
              placeholder="123456"
              autocomplete="off"
            />
          </div>
          
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
        
        <div class="text-center mt-6">
          <a href="/forgot-password" class="text-black font-bold underline">Resend OTP Code</a>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  :global(input) {
    border-radius: 0 !important;
  }
</style>
