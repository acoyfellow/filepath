<script lang="ts">
  import { forgetPasswordEmailOTP } from '$lib/auth-client';
  
  let email = $state('');
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let success = $state(false);
  
  async function handleSubmit() {
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
  <title>Forgot Password - myfilepath.com</title>
</svelte:head>

<div class="min-h-screen bg-white flex items-center justify-center p-4">
  <div class="w-full max-w-md border-4 border-black bg-white">
    <div class="p-8">
      <h1 class="text-3xl font-black mb-2 text-center">FORGOT PASSWORD</h1>
      <p class="text-gray-600 text-center mb-8">We'll send you a reset link</p>
      
      {#if success}
        <div class="bg-green-50 border-4 border-green-500 p-4 mb-6">
          <p class="text-green-700 font-bold">Check your email for a password reset link.</p>
        </div>
        <div class="text-center">
          <a href="/signup" class="text-black font-bold underline">Back to Sign In</a>
        </div>
      {:else}
        {#if error}
          <div class="bg-red-50 border-4 border-red-500 p-4 mb-6">
            <p class="text-red-700 font-bold">{error}</p>
          </div>
        {/if}
        
        <form onsubmit={handleSubmit}>
          <div class="mb-6">
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
          
          <button
            type="submit"
            disabled={isLoading}
            class="w-full px-4 py-3 font-black border-4 border-black bg-black text-white hover:bg-white hover:text-black disabled:opacity-50 mb-4"
          >
            {isLoading ? 'SENDING...' : 'SEND RESET LINK'}
          </button>
        </form>
        
        <div class="text-center mt-6">
          <a href="/signup" class="text-black font-bold underline">Back to Sign In</a>
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
