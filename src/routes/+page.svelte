<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { PUBLIC_APP_NAME } from '$env/static/public';
</script>

<svelte:head>
  <title>{PUBLIC_APP_NAME}</title>
  <meta name="description" content="Persistent containers for autonomous agent loops." />
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
      <a href="/login" class="hover:text-neutral-100">login</a>
    </div>
  </nav>

  <!-- Hero -->
  <main class="max-w-2xl mx-auto px-6 py-20">
    <h1 class="text-neutral-100 text-xl font-medium mb-6">A home for autonomous work.</h1>
    
    <p class="mb-10 leading-relaxed text-lg">
      Persistent Linux containers for agent loops. 
      Runs survive context limits. Artifacts remain. Recovery is expected.
    </p>

    <!-- Capabilities -->
    <section class="mb-12">
      <h2 class="text-neutral-500 text-xs uppercase tracking-wide mb-4">Capabilities</h2>
      <ul class="space-y-2 text-sm">
        <li>• Full shell access <span class="text-neutral-500 font-mono">(bash, git, npm, etc)</span></li>
        <li>• Filesystem persists across sessions</li>
        <li>• Background processes supported</li>
        <li>• Health checks between runs</li>
        <li>• Handoff protocol for context limits</li>
      </ul>
    </section>

    <!-- Pricing -->
    <section class="mb-12">
      <h2 class="text-neutral-500 text-xs uppercase tracking-wide mb-4">Pricing</h2>
      <div class="text-sm space-y-1">
        <p><span class="text-neutral-100 font-mono">$0.01/min</span> active compute</p>
        <p><span class="text-neutral-100 font-mono">$0.00/min</span> idle (container sleeps)</p>
        <p class="text-neutral-500">Prepaid credits. Human approves spend.</p>
      </div>
    </section>

    <!-- API -->
    <section class="mb-12">
      <h2 class="text-neutral-500 text-xs uppercase tracking-wide mb-4">API</h2>
      <div class="bg-neutral-900 border border-neutral-800 rounded p-4 text-sm overflow-x-auto">
        <pre class="text-neutral-400 font-mono"><code>POST /api/orchestrator
Header: x-api-key: &lt;key&gt;
Body: {JSON.stringify({sessionId: "string", task: "string"})}

Response: {JSON.stringify({success: true, result: "..."})}</code></pre>
      </div>
    </section>

    <!-- Limits -->
    <section class="mb-12">
      <h2 class="text-neutral-500 text-xs uppercase tracking-wide mb-4">Limits</h2>
      <ul class="space-y-1 text-sm text-neutral-500">
        <li>• No GPU (yet)</li>
        <li>• 2GB RAM max</li>
        <li>• Cloudflare network egress</li>
        <li>• Container sleeps after 5min idle</li>
      </ul>
    </section>

    <!-- CTA -->
    <section class="border-t border-neutral-800 pt-8">
      <a href="/login" class="text-neutral-100 hover:underline">→ Get started</a>
      <span class="text-neutral-600 ml-4">or</span>
      <a href="/docs" class="text-neutral-400 hover:underline ml-2">read docs</a>
    </section>
  </main>

  <!-- Footer -->
  <footer class="border-t border-neutral-800 px-6 py-6 text-center text-neutral-600 text-xs font-mono">
    {PUBLIC_APP_NAME}
  </footer>
</div>
