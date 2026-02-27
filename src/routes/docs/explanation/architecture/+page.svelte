<script lang="ts">
  import { browser } from '$app/environment';
  import Nav from '$lib/components/Nav.svelte';

  let dark = $state(browser && document.documentElement.classList.contains('dark'));

  if (browser) {
    const observer = new MutationObserver(() => {
      dark = document.documentElement.classList.contains('dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }
</script>

<svelte:head>
  <title>Architecture Deep Dive | filepath</title>
  <meta name="description" content="Understanding filepath's architecture: Cloudflare Workers, Durable Objects, D1, and the agent protocol." />
</svelte:head>

<div class="min-h-screen font-sans {dark ? 'bg-neutral-950 text-neutral-300' : 'bg-gray-50 text-gray-700'} transition-colors duration-200">
  <Nav />

<main class="max-w-3xl mx-auto px-6 py-12">
  <div class="mb-8">
    <a href="/docs" class="{dark ? 'text-neutral-500' : 'text-gray-500'} hover:text-neutral-300 text-sm">Back to Docs</a>
  </div>

  <h1 class="text-3xl font-medium {dark ? 'text-neutral-100' : 'text-gray-900'} mb-4">Architecture</h1>
  <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} mb-12">How filepath works under the hood.</p>

  <section class="mb-12">
    <h2 class="text-xl font-medium {dark ? 'text-neutral-200' : 'text-gray-800'} mb-4">High-Level Architecture</h2>
    <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} mb-4">filepath runs on Cloudflare's edge infrastructure:</p>
    <ul class="space-y-2 {dark ? 'text-neutral-400' : 'text-gray-600'} list-disc list-inside">
      <li><strong>Cloudflare Workers</strong> — HTTP API, WebSocket handling, static assets</li>
      <li><strong>Durable Objects (DO)</strong> — One ChatAgent DO per agent node</li>
      <li><strong>D1</strong> — SQLite database for sessions, nodes, users</li>
      <li><strong>Cloudflare Sandbox</strong> — Container runtime for agent code</li>
    </ul>
  </section>

  <section class="mb-12">
    <h2 class="text-xl font-medium {dark ? 'text-neutral-200' : 'text-gray-800'} mb-4">Data Flow</h2>
    <div class="{dark ? 'bg-neutral-900' : 'bg-white'} border {dark ? 'border-neutral-800' : 'border-gray-200'} rounded-lg p-6 font-mono text-sm {dark ? 'text-neutral-300' : 'text-gray-700'}">
      <div class="space-y-2">
      <div>Browser &lt;-&gt; Worker (SvelteKit + API routes)</div>
        <div class="pl-4 {dark ? 'text-neutral-500' : 'text-gray-500'}">↓ WebSocket upgrade</div>
      <div class="pl-4">Browser &lt;-&gt; ChatAgent DO (per agent node)</div>
        <div class="pl-8 {dark ? 'text-neutral-500' : 'text-gray-500'}">↓ fetch / stdin-stdout</div>
      <div class="pl-8">ChatAgent DO &lt;-&gt; LLM API (OpenRouter)</div>
        <div class="pl-4 {dark ? 'text-neutral-500' : 'text-gray-500'}">↓ D1 queries</div>
      <div>ChatAgent DO &lt;-&gt; D1 (node lookup, history)</div>
      </div>
    </div>
  </section>

  <section class="mb-12">
    <h2 class="text-xl font-medium {dark ? 'text-neutral-200' : 'text-gray-800'} mb-4">Key Components</h2>
    
    <div class="space-y-6">
      <div class="border-l-2 border-neutral-700 pl-4">
        <h3 class="{dark ? 'text-neutral-300' : 'text-gray-700'} font-medium mb-2">ChatAgent DO</h3>
        <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} text-sm">One per agent node. Maintains WebSocket connection, message history, and calls LLM APIs. Not the "brain"—just a relay/conductor.</p>
      </div>
      
      <div class="border-l-2 border-neutral-700 pl-4">
        <h3 class="{dark ? 'text-neutral-300' : 'text-gray-700'} font-medium mb-2">D1 Database</h3>
        <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} text-sm">SQLite on the edge. Stores agent sessions, nodes, user data, conversation history. Self-referential tree via agentNode.parentId.</p>
      </div>
      
      <div class="border-l-2 border-neutral-700 pl-4">
        <h3 class="{dark ? 'text-neutral-300' : 'text-gray-700'} font-medium mb-2">Worker</h3>
        <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} text-sm">SvelteKit app on Cloudflare. Handles HTTP routes, serves UI, proxies WebSocket upgrade to DOs.</p>
      </div>
      
      <div class="border-l-2 border-neutral-700 pl-4">
        <h3 class="{dark ? 'text-neutral-300' : 'text-gray-700'} font-medium mb-2">Sandbox (Future)</h3>
        <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} text-sm">Cloudflare Sandbox for running containerized agents. Currently using direct LLM mode.</p>
      </div>
    </div>
  </section>

  <section class="mb-12">
    <h2 class="text-xl font-medium {dark ? 'text-neutral-200' : 'text-gray-800'} mb-4">BYOK Model</h2>
    <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} mb-4">Bring Your Own Key:</p>
    <ul class="space-y-2 {dark ? 'text-neutral-400' : 'text-gray-600'} list-disc list-inside">
      <li>Users provide their own LLM API keys</li>
      <li>Keys stored encrypted in D1 (AES-256-GCM)</li>
      <li>Account-level keys: stored on user table</li>
      <li>Per-session keys: stored on agent_session table</li>
      <li>Per-node override: passed when spawning</li>
    </ul>
  </section>

  <section class="mb-12">
    <h2 class="text-xl font-medium {dark ? 'text-neutral-200' : 'text-gray-800'} mb-4">Scaling</h2>
    <ul class="space-y-2 {dark ? 'text-neutral-400' : 'text-gray-600'} list-disc list-inside">
      <li>Workers scale automatically (edge-deployed)</li>
      <li>Each DO is single-threaded but durable (state persists)</li>
      <li>D1 scales reads well; writes are serialized per-region</li>
      <li>Agents don't share state—perfect for horizontal scaling</li>
    </ul>
  </section>

  <footer class="border-t {dark ? 'border-neutral-800' : 'border-gray-200'} pt-6 text-center">
    <p class="{dark ? 'text-neutral-500' : 'text-gray-500'} text-sm">
        <a href="/docs/explanation/protocol" class="{dark ? 'text-neutral-300' : 'text-gray-700'} hover:underline">Next: Protocol Deep Dive</a>
    </p>
  </footer>
</main>
</div>
