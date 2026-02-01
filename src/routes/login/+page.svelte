<script lang="ts">
  import { PUBLIC_APP_NAME } from '$env/static/public';
</script>

<svelte:head>
  <title>Login - {PUBLIC_APP_NAME}</title>
</svelte:head>

<div class="min-h-screen bg-neutral-950 text-neutral-300 font-sans">
  <!-- Nav -->
  <nav class="border-b border-neutral-800 px-6 py-4 flex justify-between items-center">
    <a href="/" class="flex items-center gap-2">
      <svg width="24" height="24" viewBox="0 0 339 339" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M119.261 35C128.462 35.0001 137.256 38.8378 143.569 45.6083L160.108 63.3453C166.421 70.1159 175.215 73.9536 184.416 73.9536H298.583C317.039 73.9536 332 89.0902 332 107.762V270.191C332 288.863 317.039 304 298.583 304H41.417C22.9613 304 8 288.863 8 270.191V68.8087C8.0001 50.1368 22.9614 35 41.417 35H119.261ZM169.23 219.37V259.415H291.318V219.37H169.23ZM50.7361 111.182L110.398 171.838L51.027 226.311L79.9846 258.994L169.77 173.606L82.022 81.2961L50.7361 111.182Z" fill="currentColor"/>
      </svg>
      <span class="text-neutral-100 font-medium">{PUBLIC_APP_NAME}</span>
    </a>
    <div class="flex gap-6 text-sm">
      <a href="/docs" class="hover:text-neutral-100">docs</a>
      <a href="/pricing" class="hover:text-neutral-100">pricing</a>
      <a href="/login" class="text-neutral-100">login</a>
    </div>
  </nav>

  <main class="max-w-sm mx-auto px-6 py-20">
    <div class="text-center mb-8">
      <svg width="48" height="48" viewBox="0 0 339 339" fill="none" xmlns="http://www.w3.org/2000/svg" class="mx-auto mb-4">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M119.261 35C128.462 35.0001 137.256 38.8378 143.569 45.6083L160.108 63.3453C166.421 70.1159 175.215 73.9536 184.416 73.9536H298.583C317.039 73.9536 332 89.0902 332 107.762V270.191C332 288.863 317.039 304 298.583 304H41.417C22.9613 304 8 288.863 8 270.191V68.8087C8.0001 50.1368 22.9614 35 41.417 35H119.261ZM169.23 219.37V259.415H291.318V219.37H169.23ZM50.7361 111.182L110.398 171.838L51.027 226.311L79.9846 258.994L169.77 173.606L82.022 81.2961L50.7361 111.182Z" fill="currentColor"/>
      </svg>
      <h1 class="text-neutral-100 text-lg font-medium">Sign in to {PUBLIC_APP_NAME}</h1>
    </div>

    <form class="space-y-4" method="POST">
      <div>
        <label for="email" class="block text-sm text-neutral-500 mb-2">Email</label>
        <input 
          id="email"
          type="email" 
          name="email"
          class="w-full bg-neutral-900 border border-neutral-800 rounded px-4 py-3 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
          placeholder="you@example.com"
          required
        />
      </div>
      
      <div>
        <label for="password" class="block text-sm text-neutral-500 mb-2">Password</label>
        <input 
          id="password"
          type="password" 
          name="password"
          class="w-full bg-neutral-900 border border-neutral-800 rounded px-4 py-3 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
          placeholder="********"
          required
        />
      </div>

      <button 
        type="submit"
        class="w-full bg-neutral-100 text-neutral-950 rounded px-4 py-3 font-medium hover:bg-neutral-200 transition-colors"
      >
        Sign in
      </button>
    </form>

    <div class="mt-6 text-center text-sm">
      <span class="text-neutral-500">Do not have an account?</span>
      <a href="/signup" class="text-neutral-100 hover:underline ml-1">Sign up</a>
    </div>

    <div class="mt-8 pt-8 border-t border-neutral-800 text-center text-xs text-neutral-600">
      Humans sign in here. Agents use API keys.
    </div>
  </main>

  <footer class="border-t border-neutral-800 px-6 py-6 text-center text-neutral-600 text-xs font-mono">
    {PUBLIC_APP_NAME}
  </footer>
</div>
