<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { signIn, signUp, signOut } from '$lib/auth-client';
  
  let email = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let isSignUp = $state(true);
  
  onMount(() => {
    // If user is already authenticated, redirect to dashboard
    if (page.data.user) {
      goto('/dashboard');
    }
  });
  
  async function handleSubmit() {
    if (!email.trim()) {
      error = 'Email is required';
      return;
    }
    
    if (isSignUp) {
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
    } else {
      if (!password.trim()) {
        error = 'Password is required';
        return;
      }
    }
    
    isLoading = true;
    error = null;
    
    try {
      if (isSignUp) {
        const result = await signUp.email({
          email,
          password,
          name: email.split('@')[0]
        });
        
        if (result.error) {
          error = result.error.message;
          return;
        }
        
        // After sign up, redirect to dashboard
        goto('/dashboard');
      } else {
        const result = await signIn.email({ email, password });
        
        if (result.error) {
          error = result.error.message;
          return;
        }
        
        // After sign in, redirect to dashboard
        goto('/dashboard');
      }
    } catch (err) {
      error = 'An unexpected error occurred. Please try again.';
      console.error(err);
    } finally {
      isLoading = false;
    }
  }
  
  function toggleMode() {
    isSignUp = !isSignUp;
    error = null;
  }
</script>

<svelte:head>
  <title>{isSignUp ? 'Sign Up' : 'Sign In'} - myfilepath.com</title>
</svelte:head>

<div class="min-h-screen bg-white flex items-center justify-center p-4">
  <div class="w-full max-w-md border-4 border-black bg-white">
    <div class="p-8">
      <h1 class="text-3xl font-black mb-2 text-center">{isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'}</h1>
      <p class="text-gray-600 text-center mb-8">{isSignUp ? 'Start your AI agent journey' : 'Welcome back'}</p>
      
      {#if error}
        <div class="bg-red-50 border-4 border-red-500 p-4 mb-6">
          <p class="text-red-700 font-bold">{error}</p>
        </div>
      {/if}
      
      <form onsubmit|preventDefault={handleSubmit}>
        <div class="mb-4">
          <label for="email" class="block text-sm font-bold mb-2">EMAIL</label>
          <input
            id="email"
            type="email"
            bind:value={email}
            class="w-full px-3 py-2 border-4 border-black focus:outline-none focus:ring-0"
            placeholder="your@email.com"
          />
        </div>
        
        <div class="mb-4">
          <label for="password" class="block text-sm font-bold mb-2">PASSWORD</label>
          <input
            id="password"
            type="password"
            bind:value={password}
            class="w-full px-3 py-2 border-4 border-black focus:outline-none focus:ring-0"
            placeholder="••••••••"
          />
        </div>
        
        {#if isSignUp}
          <div class="mb-6">
            <label for="confirmPassword" class="block text-sm font-bold mb-2">CONFIRM PASSWORD</label>
            <input
              id="confirmPassword"
              type="password"
              bind:value={confirmPassword}
              class="w-full px-3 py-2 border-4 border-black focus:outline-none focus:ring-0"
              placeholder="••••••••"
            />
          </div>
        {/if}
        
        <button
          type="submit"
          disabled={isLoading}
          class="w-full px-4 py-3 font-black border-4 border-black bg-black text-white hover:bg-white hover:text-black disabled:opacity-50 mb-4"
        >
          {isLoading ? 'PROCESSING...' : (isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN')}
        </button>
      </form>
      
      <div class="text-center mt-6">
        <button 
          onclick={toggleMode}
          class="text-black font-bold underline"
        >
          {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
        </button>
      </div>
      
      <div class="mt-8 pt-6 border-t-4 border-black text-center">
        <p class="text-sm text-gray-600 mb-2">SECURE AUTHENTICATION</p>
        <p class="text-xs text-gray-500">Passkey support coming soon. Email/password for now.</p>
      </div>
    </div>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background-color: #f5f5f5;
  }
  
  :global(input) {
    border-radius: 0 !important;
  }
</style>