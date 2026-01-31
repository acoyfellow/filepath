<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { signIn, signUp, signOut, passkey } from '$lib/auth-client';
  
  let email = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let passkeyName = $state('');
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let isSignUp = $state(true);
  let showPasskeyForm = $state(false);
  
  onMount(() => {
    // If user is already authenticated, redirect to dashboard
    if (page.data.user) {
      goto('/dashboard');
    }
    
    // Check if browser supports Conditional UI for passkeys
    checkConditionalUI();
  });
  
  async function checkConditionalUI() {
    if (!window.PublicKeyCredential?.isConditionalMediationAvailable) {
      return;
    }
    const available = await window.PublicKeyCredential.isConditionalMediationAvailable();
    if (!available) return;
    
    // Preload for autofill
    try {
      await signIn.passkey({ autoFill: true });
    } catch (err) {
      // Auto-fill failed, which is normal if no passkey is available
      console.debug('Passkey auto-fill not available:', err);
    }
  }
  
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
          error = result.error.message || 'An error occurred';
          return;
        }
        
        // After sign up, redirect to dashboard
        goto('/dashboard');
      } else {
        const result = await signIn.email({ email, password });
        
        if (result.error) {
          error = result.error.message || 'An error occurred';
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
  
  async function handlePasskeySignIn() {
    isLoading = true;
    error = null;
    
    try {
      const result = await signIn.passkey({
        autoFill: false,
        fetchOptions: {
          onSuccess(context) {
            goto('/dashboard');
          },
          onError(context) {
            error = context.error.message;
          }
        }
      });
      
      if (result.error) {
        error = result.error.message || 'An error occurred';
        return;
      }
      
      // If successful, redirect to dashboard
      goto('/dashboard');
    } catch (err) {
      error = 'Passkey authentication failed. Please try again.';
      console.error(err);
    } finally {
      isLoading = false;
    }
  }
  
  async function handlePasskeySignUp() {
    if (!email.trim()) {
      error = 'Email is required';
      return;
    }
    
    isLoading = true;
    error = null;
    
    try {
      // First create account with email/password
      const result = await signUp.email({
        email,
        password: Math.random().toString(36).slice(-8) + 'A1!', // Generate a random password
        name: email.split('@')[0]
      });
      
      if (result.error) {
        error = result.error.message || 'An error occurred';
        return;
      }
      
      // Then register passkey
      const passkeyResult = await passkey.addPasskey({
        name: passkeyName || "My Passkey",
        authenticatorAttachment: "platform"
      });
      
      if (passkeyResult.error) {
        error = passkeyResult.error.message || 'Passkey registration failed';
        // Note: Account was created but passkey registration failed
        // In a production app, you might want to handle this more gracefully
        return;
      }
      
      // After successful passkey registration, redirect to dashboard
      goto('/dashboard');
    } catch (err) {
      error = 'Passkey registration failed. Please try again.';
      console.error(err);
    } finally {
      isLoading = false;
    }
  }
  
  function toggleMode() {
    isSignUp = !isSignUp;
    error = null;
  }
  
  function togglePasskeyForm() {
    showPasskeyForm = !showPasskeyForm;
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
      
      {#if showPasskeyForm}
        <div class="mb-6">
          <h2 class="text-xl font-black mb-4 text-center">PASSKEY {isSignUp ? 'REGISTRATION' : 'SIGN IN'}</h2>
          
          {#if isSignUp}
            <div class="mb-4">
              <label for="passkeyEmail" class="block text-sm font-bold mb-2">EMAIL</label>
              <input
                id="passkeyEmail"
                type="email"
                bind:value={email}
                class="w-full px-3 py-2 border-4 border-black focus:outline-none focus:ring-0"
                placeholder="your@email.com"
                autocomplete="username webauthn"
              />
            </div>
            
            <div class="mb-4">
              <label for="passkeyName" class="block text-sm font-bold mb-2">PASSKEY NAME (OPTIONAL)</label>
              <input
                id="passkeyName"
                type="text"
                bind:value={passkeyName}
                class="w-full px-3 py-2 border-4 border-black focus:outline-none focus:ring-0"
                placeholder="e.g., My MacBook Touch ID"
              />
            </div>
            
            <button
              type="button"
              onclick={handlePasskeySignUp}
              disabled={isLoading}
              class="w-full px-4 py-3 font-black border-4 border-black bg-black text-white hover:bg-white hover:text-black disabled:opacity-50 mb-4"
            >
              {isLoading ? 'REGISTERING PASSKEY...' : 'REGISTER PASSKEY'}
            </button>
          {:else}
            <button
              type="button"
              onclick={handlePasskeySignIn}
              disabled={isLoading}
              class="w-full px-4 py-3 font-black border-4 border-black bg-black text-white hover:bg-white hover:text-black disabled:opacity-50 mb-4"
            >
              {isLoading ? 'AUTHENTICATING...' : 'SIGN IN WITH PASSKEY'}
            </button>
          {/if}
          
          <div class="text-center mt-4">
            <button 
              onclick={togglePasskeyForm}
              class="text-black font-bold underline"
            >
              Back to {isSignUp ? 'email signup' : 'email signin'}
            </button>
          </div>
        </div>
      {:else}
        <form onsubmit={handleSubmit}>
          <div class="mb-4">
            <label for="email" class="block text-sm font-bold mb-2">EMAIL</label>
            <input
              id="email"
              type="email"
              bind:value={email}
              class="w-full px-3 py-2 border-4 border-black focus:outline-none focus:ring-0"
              placeholder="your@email.com"
              autocomplete="username webauthn"
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
              autocomplete="current-password webauthn"
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
        
        <div class="relative my-6">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t-4 border-black"></div>
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="px-2 bg-white text-black font-black">OR</span>
          </div>
        </div>
        
        <button
          type="button"
          onclick={togglePasskeyForm}
          class="w-full px-4 py-3 font-black border-4 border-black hover:bg-black hover:text-white mb-4"
        >
          {isSignUp ? 'SIGN UP WITH PASSKEY' : 'SIGN IN WITH PASSKEY'}
        </button>
        
        <div class="text-center mt-6">
          <button 
            onclick={toggleMode}
            class="text-black font-bold underline"
          >
            {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
          </button>
        </div>
      {/if}
      
      <div class="mt-8 pt-6 border-t-4 border-black text-center">
        <p class="text-sm text-gray-600 mb-2">SECURE AUTHENTICATION</p>
        <p class="text-xs text-gray-500">Passkey authentication is now available. More secure than passwords.</p>
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