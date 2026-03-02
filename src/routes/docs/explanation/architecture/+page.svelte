<script lang="ts">
</script>

<svelte:head>
  <title>Architecture Deep Dive | filepath</title>
  <meta name="description" content="Understanding filepath's architecture: sessions, threads, Cloudflare sandboxes, and the agent protocol." />
</svelte:head>

<div class="min-h-screen font-sans bg-gray-50 text-gray-700 dark:bg-neutral-950 dark:text-neutral-300 transition-colors duration-200">
<main class="max-w-3xl mx-auto px-6 py-12">
  <div class="mb-8">
    <a href="/docs" class="text-gray-500 dark:text-neutral-500 hover:text-neutral-300 text-sm">Back to Docs</a>
  </div>

  <h1 class="text-3xl font-medium text-gray-900 dark:text-neutral-100 mb-4">Architecture</h1>
  <p class="text-gray-600 dark:text-neutral-400 mb-12">How filepath works under the hood: sessions, threads, and sandbox runtimes.</p>

  <section class="mb-12">
    <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200 mb-4">High-Level Architecture</h2>
    <p class="text-gray-600 dark:text-neutral-400 mb-4">filepath runs on Cloudflare's edge infrastructure:</p>
    <ul class="space-y-2 text-gray-600 dark:text-neutral-400 list-disc list-inside">
      <li><strong>Cloudflare Workers</strong> — HTTP API, WebSocket handling, static assets</li>
      <li><strong>Durable Objects (DO)</strong> — One ChatAgent DO per thread node</li>
      <li><strong>D1</strong> — SQLite database for sessions, nodes, users</li>
      <li><strong>Cloudflare Sandbox</strong> — Container runtime for agent code</li>
    </ul>
  </section>

  <section class="mb-12">
    <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200 mb-4">Data Flow</h2>
    <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-6 font-mono text-sm text-gray-700 dark:text-neutral-300">
      <div class="space-y-2">
      <div>Browser &lt;-&gt; Worker (SvelteKit + API routes)</div>
        <div class="pl-4 text-gray-500 dark:text-neutral-500">↓ WebSocket upgrade</div>
      <div class="pl-4">Browser &lt;-&gt; ChatAgent DO (per thread node)</div>
        <div class="pl-8 text-gray-500 dark:text-neutral-500">↓ fetch / stdin-stdout</div>
      <div class="pl-8">ChatAgent DO &lt;-&gt; sandbox thread runtime</div>
        <div class="pl-4 text-gray-500 dark:text-neutral-500">↓ D1 queries</div>
      <div>ChatAgent DO &lt;-&gt; D1 (node lookup, history)</div>
      </div>
    </div>
  </section>

  <section class="mb-12">
    <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200 mb-4">Key Components</h2>
    
    <div class="space-y-6">
      <div class="border-l-2 border-neutral-700 pl-4">
        <h3 class="text-gray-700 dark:text-neutral-300 font-medium mb-2">ChatAgent DO</h3>
        <p class="text-gray-600 dark:text-neutral-400 text-sm">One per thread node. Maintains the thread connection, message history, and routes work into the sandbox runtime. It is the relay/conductor, not the thing pretending to do the runtime work itself.</p>
      </div>
      
      <div class="border-l-2 border-neutral-700 pl-4">
        <h3 class="text-gray-700 dark:text-neutral-300 font-medium mb-2">D1 Database</h3>
        <p class="text-gray-600 dark:text-neutral-400 text-sm">SQLite on the edge. Stores sessions, thread nodes, user data, conversation history, and explicit artifact transfers. The self-referential tree lives in agentNode.parentId.</p>
      </div>
      
      <div class="border-l-2 border-neutral-700 pl-4">
        <h3 class="text-gray-700 dark:text-neutral-300 font-medium mb-2">Worker</h3>
        <p class="text-gray-600 dark:text-neutral-400 text-sm">SvelteKit app on Cloudflare. Handles HTTP routes, serves UI, proxies WebSocket upgrade to DOs.</p>
      </div>
      
      <div class="border-l-2 border-neutral-700 pl-4">
        <h3 class="text-gray-700 dark:text-neutral-300 font-medium mb-2">Sandbox Runtime</h3>
        <p class="text-gray-600 dark:text-neutral-400 text-sm">Cloudflare Sandbox runs the containerized runtime for each thread. When terminal attach is available, it opens a workspace shell for that thread. If the sandbox path fails, the thread fails explicitly instead of bypassing the runtime.</p>
      </div>
    </div>
  </section>

  <section class="mb-12">
    <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200 mb-4">BYOK Model</h2>
    <p class="text-gray-600 dark:text-neutral-400 mb-4">Bring Your Own Key:</p>
    <ul class="space-y-2 text-gray-600 dark:text-neutral-400 list-disc list-inside">
      <li>Users provide their own LLM API keys</li>
      <li>Keys stored encrypted in D1 (AES-256-GCM)</li>
      <li>Account-level keys: stored on user table</li>
      <li>Per-session keys: stored on agent_session table</li>
      <li>Per-node override: passed when spawning</li>
    </ul>
  </section>

  <section class="mb-12">
    <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200 mb-4">Scaling</h2>
    <ul class="space-y-2 text-gray-600 dark:text-neutral-400 list-disc list-inside">
      <li>Workers scale automatically (edge-deployed)</li>
      <li>Each DO is single-threaded but durable (state persists)</li>
      <li>D1 scales reads well; writes are serialized per-region</li>
      <li>Threads are isolated by default; file handoff is explicit instead of invisible shared state</li>
    </ul>
  </section>

  <footer class="border-t border-gray-200 dark:border-neutral-800 pt-6 text-center">
    <p class="text-gray-500 dark:text-neutral-500 text-sm">
        <a href="/docs/explanation/protocol" class="text-gray-700 dark:text-neutral-300 hover:underline">Next: Protocol Deep Dive</a>
    </p>
  </footer>
</main>
</div>
