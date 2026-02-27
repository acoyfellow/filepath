<script lang="ts">
  import Nav from '$lib/components/Nav.svelte';
</script>

<svelte:head>
  <title>filepath - Orchestrate AI Coding Agents</title>
  <meta name="description" content="Spawn AI coding agents in persistent containers. Visualize them as a tree. Watch parallel work in real-time chat. BYOK - bring your own API keys." />
</svelte:head>

<div class="min-h-screen bg-neutral-950 text-neutral-300 font-sans relative z-10">
  <div class="bg-black min-h-screen z-0 absolute inset-0 opacity-10 pointer-events-none">
    <img src="/bg.jpg" alt="Background" class="absolute inset-0 w-full h-full object-cover z-0"/>
    <div class="absolute bottom-0 left-0 w-full h-1/2 bg-linear-to-t from-neutral-950 to-transparent z-10"></div>
  </div>

  <Nav variant="centered" />

  <!-- Hero -->
  <main class="max-w-2xl mx-auto px-6 py-20">
    <h1 class="text-neutral-100 text-2xl font-medium mb-4">
      Orchestrate AI coding agents in persistent containers.
    </h1>
    
    <p class="mb-12 leading-relaxed text-lg text-neutral-400">
      Spawn agents. Watch them work in parallel. The tree visualizes everything.<br/>
      <span class="text-neutral-500">Bring your own API keys. Your compute, your agents, your control.</span>
    </p>

    <!-- Visual Preview -->
    <section class="mb-12 bg-neutral-900 border border-neutral-800 rounded-lg p-6">
      <div class="flex gap-6">
        <!-- Tree visualization mock -->
        <div class="w-48 space-y-2 text-sm">
          <div class="flex items-center gap-2 text-neutral-300">
            <span class="w-2 h-2 rounded-full bg-green-500"></span>
            <span>Project Setup</span>
          </div>
          <div class="pl-4 flex items-center gap-2 text-neutral-400">
            <span class="w-2 h-2 rounded-full bg-yellow-500"></span>
            <span>Research API</span>
          </div>
          <div class="pl-4 flex items-center gap-2 text-neutral-400">
            <span class="w-2 h-2 rounded-full bg-green-500"></span>
            <span>Write Tests</span>
          </div>
          <div class="pl-8 flex items-center gap-2 text-neutral-500">
            <span class="w-2 h-2 rounded-full bg-neutral-600"></span>
            <span>Fix Edge Case</span>
          </div>
        </div>
        
        <div class="flex-1 border-l border-neutral-800 pl-6">
          <p class="text-xs text-neutral-500 mb-2">Click any agent to see its conversation</p>
          <div class="space-y-3 text-sm">
            <div class="flex gap-3">
              <span class="text-neutral-500">user</span>
              <span class="text-neutral-300">Research the API and write tests</span>
            </div>
            <div class="flex gap-3">
              <span class="text-neutral-500">agent</span>
              <span class="text-neutral-400">I'll spawn a researcher and a test writer to work in parallel...</span>
            </div>
            <div class="bg-neutral-950 rounded p-2 text-xs text-neutral-500 font-mono">
              Spawning child agent: Researcher (pi)
            </div>
            <div class="bg-neutral-950 rounded p-2 text-xs text-neutral-500 font-mono">
              Spawning child agent: Test Writer (shelley)
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- What You Get -->
    <section class="mb-12">
      <h2 class="text-neutral-500 text-xs uppercase tracking-wide mb-4">What You Get</h2>
      <ul class="space-y-3 text-sm">
        <li class="flex gap-3">
          <span class="text-neutral-600">-</span>
          <span>Tree visualization shows every agent's status at a glance</span>
        </li>
        <li class="flex gap-3">
          <span class="text-neutral-600">-</span>
          <span>Click any agent to see its full conversation history</span>
        </li>
        <li class="flex gap-3">
          <span class="text-neutral-600">-</span>
          <span>Agents spawn child agents — workflows that branch automatically</span>
        </li>
        <li class="flex gap-3">
          <span class="text-neutral-600">-</span>
          <span>Real-time chat with tool calls, file writes, commits inline</span>
        </li>
        <li class="flex gap-3">
          <span class="text-neutral-600">-</span>
          <span>Close your laptop, reopen anywhere — same state</span>
        </li>
      </ul>
    </section>

    <!-- Built-in Agents -->
    <section class="mb-12">
      <h2 class="text-neutral-500 text-xs uppercase tracking-wide mb-4">Built-in Agents</h2>
      <div class="grid grid-cols-2 gap-3 text-sm">
        <div class="bg-neutral-900 border border-neutral-800 rounded p-3">
          <span class="text-neutral-300">Shelley</span>
          <span class="text-neutral-600 block text-xs">Full-stack engineering</span>
        </div>
        <div class="bg-neutral-900 border border-neutral-800 rounded p-3">
          <span class="text-neutral-300">Pi</span>
          <span class="text-neutral-600 block text-xs">Research and analysis</span>
        </div>
        <div class="bg-neutral-900 border border-neutral-800 rounded p-3">
          <span class="text-neutral-300">Claude Code</span>
          <span class="text-neutral-600 block text-xs">Complex multi-file changes</span>
        </div>
        <div class="bg-neutral-900 border border-neutral-800 rounded p-3">
          <span class="text-neutral-300">Codex</span>
          <span class="text-neutral-600 block text-xs">Python and data tasks</span>
        </div>
      </div>
      <p class="text-neutral-500 text-xs mt-3">
        Plus: Cursor, Amp, OpenCode. Or bring your own container.
      </p>
    </section>

    <!-- BYOK Model -->
    <section class="mb-12">
      <h2 class="text-neutral-500 text-xs uppercase tracking-wide mb-4">Bring Your Own Key</h2>
      <div class="text-sm space-y-2">
        <p>Your OpenRouter API key = your compute spend. No markup.</p>
        <p class="text-neutral-400">Access 100+ models (Claude, GPT-4, Gemini) through one key.</p>
        <p class="text-neutral-500 text-xs mt-3">
          Get an OpenRouter key at <a href="https://openrouter.ai/keys" class="text-neutral-400 hover:underline">openrouter.ai/keys</a>, then add it in Settings / Account.
        </p>
      </div>
    </section>

    <!-- How It Works -->
    <section class="mb-12">
      <h2 class="text-neutral-500 text-xs uppercase tracking-wide mb-4">How It Works</h2>
      <ol class="space-y-3 text-sm">
        <li class="flex gap-3">
          <span class="text-neutral-600">1.</span>
          <span>Create a session (like a project folder)</span>
        </li>
        <li class="flex gap-3">
          <span class="text-neutral-600">2.</span>
          <span>Spawn an agent — pick type, model, name</span>
        </li>
        <li class="flex gap-3">
          <span class="text-neutral-600">3.</span>
          <span>Chat with it — watch it write code, spawn helpers, commit</span>
        </li>
        <li class="flex gap-3">
          <span class="text-neutral-600">4.</span>
          <span>Tree grows automatically as agents spawn children</span>
        </li>
      </ol>
    </section>

    <!-- CTA -->
    <section class="border-t border-neutral-800 pt-8">
      <a href="/signup" class="text-neutral-100 hover:underline">Start executing</a>
      <span class="text-neutral-600 mx-4">or</span>
      <a href="/docs" class="text-neutral-400 hover:underline">read the docs</a>
    </section>
  </main>

  <!-- Footer -->
  <footer class="border-t border-neutral-800 px-6 py-6 text-center text-neutral-600 text-xs font-mono space-y-2">
    <div>myfilepath.com</div>
    <div class="text-neutral-500">
      <a href="https://github.com/acoyfellow/filepath" class="hover:text-neutral-300 transition-colors">Open source on GitHub</a>
      <span class="mx-2">-</span>
      <span>Hosted on Cloudflare</span>
    </div>
  </footer>
</div>
