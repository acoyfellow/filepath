<script lang="ts">
  import Nav from '$lib/components/Nav.svelte';
</script>

<svelte:head>
  <title>Architecture Deep Dive | filepath</title>
  <meta name="description" content="Understanding filepath's architecture: Cloudflare Workers, Durable Objects, D1, and the agent protocol." />
</svelte:head>

<Nav variant="centered" />

<main class="max-w-3xl mx-auto px-6 py-12">
  <div class="mb-8">
    <a href="/docs" class="text-neutral-500 hover:text-neutral-300 text-sm">← Back to Docs</a>
  </div>

  <h1 class="text-3xl font-medium text-neutral-100 mb-4">Architecture</h1>
  <p class="text-neutral-400 mb-12">How filepath works under the hood.</p>

  <section class="mb-12">
    <h2 class="text-xl font-medium text-neutral-200 mb-4">High-Level Architecture</h2>
    <p class="text-neutral-400 mb-4">filepath runs on Cloudflare's edge infrastructure:</p>
    <ul class="space-y-2 text-neutral-400 list-disc list-inside">
      <li><strong>Cloudflare Workers</strong> — HTTP API, WebSocket handling, static assets</li>
      <li><strong>Durable Objects (DO)</strong> — One ChatAgent DO per agent node</li>
      <li><strong>D1</strong> — SQLite database for sessions, nodes, users</li>
      <li><strong>Cloudflare Sandbox</strong> — Container runtime for agent code</li>
    </ul>
  </section>

  <section class="mb-12">
    <h2 class="text-xl font-medium text-neutral-200 mb-4">Data Flow</h2>
    <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-6 font-mono text-sm text-neutral-300">
      <div class="space-y-2">
        <div>Browser ←→ Worker (SvelteKit + API routes)</div>
        <div class="pl-4 text-neutral-500">↓ WebSocket upgrade</div>
        <div class="pl-4">Browser ←→ ChatAgent DO (per agent node)</div>
        <div class="pl-8 text-neutral-500">↓ fetch / stdin-stdout</div>
        <div class="pl-8">ChatAgent DO ←→ LLM API (OpenRouter)</div>
        <div class="pl-4 text-neutral-500">↓ D1 queries</div>
        <div>ChatAgent DO ←→ D1 (node lookup, history)</div>
      </div>
    </div>
  </section>

  <section class="mb-12">
    <h2 class="text-xl font-medium text-neutral-200 mb-4">Key Components</h2>
    
    <div class="space-y-6">
      <div class="border-l-2 border-neutral-700 pl-4">
        <h3 class="text-neutral-300 font-medium mb-2">ChatAgent DO</h3>
        <p class="text-neutral-400 text-sm">One per agent node. Maintains WebSocket connection, message history, and calls LLM APIs. Not the "brain"—just a relay/conductor.</p>
      </div>
      
      <div class="border-l-2 border-neutral-700 pl-4">
        <h3 class="text-neutral-300 font-medium mb-2">D1 Database</h3>
        <p class="text-neutral-400 text-sm">SQLite on the edge. Stores agent sessions, nodes, user data, conversation history. Self-referential tree via agentNode.parentId.</p>
      </div>
      
      <div class="border-l-2 border-neutral-700 pl-4">
        <h3 class="text-neutral-300 font-medium mb-2">Worker</h3>
        <p class="text-neutral-400 text-sm">SvelteKit app on Cloudflare. Handles HTTP routes, serves UI, proxies WebSocket upgrade to DOs.</p>
      </div>
      
      <div class="border-l-2 border-neutral-700 pl-4">
        <h3 class="text-neutral-300 font-medium mb-2">Sandbox (Future)</h3>
        <p class="text-neutral-400 text-sm">Cloudflare Sandbox for running containerized agents. Currently using direct LLM mode.</p>
      </div>
    </div>
  </section>

  <section class="mb-12">
    <h2 class="text-xl font-medium text-neutral-200 mb-4">BYOK Model</h2>
    <p class="text-neutral-400 mb-4">Bring Your Own Key:</p>
    <ul class="space-y-2 text-neutral-400 list-disc list-inside">
      <li>Users provide their own LLM API keys</li>
      <li>Keys stored encrypted in D1 (AES-256-GCM)</li>
      <li>Account-level keys: stored on user table</li>
      <li>Per-session keys: stored on agent_session table</li>
      <li>Per-node override: passed when spawning</li>
    </ul>
  </section>

  <section class="mb-12">
    <h2 class="text-xl font-medium text-neutral-200 mb-4">Scaling</h2>
    <ul class="space-y-2 text-neutral-400 list-disc list-inside">
      <li>Workers scale automatically (edge-deployed)</li>
      <li>Each DO is single-threaded but durable (state persists)</li>
      <li>D1 scales reads well; writes are serialized per-region</li>
      <li>Agents don't share state—perfect for horizontal scaling</li>
    </ul>
  </section>

  <footer class="border-t border-neutral-800 pt-6 text-center">
    <p class="text-neutral-500 text-sm">
      <a href="/docs/explanation/protocol" class="text-neutral-300 hover:underline">Next: Protocol Deep Dive →</a>
    </p>
  </footer>
</main>
