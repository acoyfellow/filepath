<script lang="ts">
  import Nav from '$lib/components/Nav.svelte';
  import HeroDemo from '$lib/components/HeroDemo.svelte';
  import { browser } from '$app/environment';
  
  let dark = $state(browser && document.documentElement.classList.contains('dark'));
  
  // Listen for theme changes from Nav or other components
  if (browser) {
    const observer = new MutationObserver(() => {
      dark = document.documentElement.classList.contains('dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }
</script>

<svelte:head>
  <title>filepath - Orchestrate AI Coding Agents</title>
  <meta name="description" content="Spawn AI coding agents in persistent containers. Visualize them as a tree. Watch parallel work in real-time chat. BYOK - bring your own API keys." />
</svelte:head>

<div class="min-h-screen font-sans relative z-10 transition-colors duration-200 {dark ? 'bg-neutral-950 text-neutral-300' : 'bg-gray-50 text-gray-700'}">
  <div class="min-h-screen z-0 absolute inset-0 pointer-events-none transition-colors duration-200 {dark ? 'bg-black opacity-10' : 'bg-white opacity-5'}">
    <img src="/bg.jpg" alt="Background" class="absolute inset-0 w-full h-full object-cover z-0"/>
    <div class="absolute bottom-0 left-0 w-full h-1/2 bg-linear-to-t {dark ? 'from-neutral-950' : 'from-gray-50'} to-transparent z-10"></div>
  </div>

  <Nav variant="centered" />

  <main class="max-w-6xl mx-auto px-6 py-12 md:py-20">
    <!-- Hero Section: Text + Demo -->
    <div class="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start mb-16">
      <!-- Left: Value Prop -->
      <div class="lg:sticky lg:top-8">
        <h1 class="text-3xl md:text-4xl font-medium mb-4 leading-tight {dark ? 'text-neutral-100' : 'text-gray-900'}">
          Orchestrate AI coding agents in persistent containers.
        </h1>
        
        <p class="mb-8 leading-relaxed text-lg {dark ? 'text-neutral-400' : 'text-gray-600'}">
          Spawn agents. Watch them work in parallel. The tree visualizes everything.
        </p>
        
        <div class="flex flex-col sm:flex-row gap-3 mb-8">
          <a href="/signup" class="inline-flex items-center justify-center px-6 py-3 rounded font-medium transition-colors {dark ? 'bg-neutral-100 hover:bg-white text-neutral-950' : 'bg-gray-900 hover:bg-gray-800 text-white'}">
            Start executing
          </a>
          <a href="/docs" class="inline-flex items-center justify-center px-6 py-3 border rounded transition-colors {dark ? 'border-neutral-700 hover:border-neutral-500' : 'border-gray-300 hover:border-gray-400'}">
            Read the docs
          </a>
        </div>
        
        <!-- Quick value props -->
        <div class="space-y-2 text-sm">
          <div class="flex items-center gap-2">
            <span class="{dark ? 'text-green-500/60' : 'text-green-600'}">-</span>
            <span class="{dark ? 'text-neutral-400' : 'text-gray-600'}">Tree shows every agent's status</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="{dark ? 'text-green-500/60' : 'text-green-600'}">-</span>
            <span class="{dark ? 'text-neutral-400' : 'text-gray-600'}">Click any agent to chat</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="{dark ? 'text-green-500/60' : 'text-green-600'}">-</span>
            <span class="{dark ? 'text-neutral-400' : 'text-gray-600'}">Agents spawn child agents automatically</span>
          </div>
        </div>
      </div>
      
      <!-- Right: Live Demo -->
      <div class="lg:mt-0">
        <HeroDemo {dark} />
        <p class="text-center text-xs mt-3 {dark ? 'text-neutral-500' : 'text-gray-500'}">
          This is the actual interface. Click agents in the tree to switch conversations.
        </p>
      </div>
    </div>

    <!-- Features Grid -->
    <section class="mb-16">
      <h2 class="text-xs uppercase tracking-wide mb-6 {dark ? 'text-neutral-500' : 'text-gray-500'}">What You Get</h2>
      <div class="grid md:grid-cols-3 gap-4">
        <div class="rounded-lg p-5 border {dark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-white border-gray-200'}">
          <h3 class="font-medium mb-2 {dark ? 'text-neutral-200' : 'text-gray-900'}">Visual Tree</h3>
          <p class="text-sm {dark ? 'text-neutral-400' : 'text-gray-600'}">See all your agents at a glance. Running, idle, done — status is obvious. Hierarchy shows who's working on what.</p>
        </div>
        <div class="rounded-lg p-5 border {dark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-white border-gray-200'}">
          <h3 class="font-medium mb-2 {dark ? 'text-neutral-200' : 'text-gray-900'}">Rich Chat</h3>
          <p class="text-sm {dark ? 'text-neutral-400' : 'text-gray-600'}">Not just text. Watch tool calls, file writes, commits, and spawned agents appear inline. Real-time via WebSocket.</p>
        </div>
        <div class="rounded-lg p-5 border {dark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-white border-gray-200'}">
          <h3 class="font-medium mb-2 {dark ? 'text-neutral-200' : 'text-gray-900'}">Persistent State</h3>
          <p class="text-sm {dark ? 'text-neutral-400' : 'text-gray-600'}">Close your laptop, reopen on your phone — same tree, same conversations. Agents continue working while you're away.</p>
        </div>
      </div>
    </section>

    <!-- Built-in Agents -->
    <section class="mb-16">
      <h2 class="text-xs uppercase tracking-wide mb-6 {dark ? 'text-neutral-500' : 'text-gray-500'}">Built-in Agents</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div class="rounded p-4 border transition-colors {dark ? 'bg-neutral-900 border-neutral-800 hover:border-neutral-700' : 'bg-white border-gray-200 hover:border-gray-300'}">
          <span class="font-medium block {dark ? 'text-neutral-200' : 'text-gray-900'}">Shelley</span>
          <span class="text-xs {dark ? 'text-neutral-500' : 'text-gray-500'}">filepath-native reference</span>
        </div>
        <div class="rounded p-4 border transition-colors {dark ? 'bg-neutral-900 border-neutral-800 hover:border-neutral-700' : 'bg-white border-gray-200 hover:border-gray-300'}">
          <span class="font-medium block {dark ? 'text-neutral-200' : 'text-gray-900'}">Pi</span>
          <span class="text-xs {dark ? 'text-neutral-500' : 'text-gray-500'}">Deep research specialist</span>
        </div>
        <div class="rounded p-4 border transition-colors {dark ? 'bg-neutral-900 border-neutral-800 hover:border-neutral-700' : 'bg-white border-gray-200 hover:border-gray-300'}">
          <span class="font-medium block {dark ? 'text-neutral-200' : 'text-gray-900'}">Claude Code</span>
          <span class="text-xs {dark ? 'text-neutral-500' : 'text-gray-500'}">Anthropic's coding agent</span>
        </div>
        <div class="rounded p-4 border transition-colors {dark ? 'bg-neutral-900 border-neutral-800 hover:border-neutral-700' : 'bg-white border-gray-200 hover:border-gray-300'}">
          <span class="font-medium block {dark ? 'text-neutral-200' : 'text-gray-900'}">Codex</span>
          <span class="text-xs {dark ? 'text-neutral-500' : 'text-gray-500'}">OpenAI's coding agent</span>
        </div>
      </div>
      <p class="text-sm mt-4 {dark ? 'text-neutral-500' : 'text-gray-600'}">
        Plus: Cursor, Amp, OpenCode. Or bring your own Docker container.
        <a href="/docs/agents" class="hover:underline ml-1 {dark ? 'text-neutral-400' : 'text-gray-700'}">View all agents</a>
      </p>
    </section>

    <!-- BYOK Model -->
    <section class="mb-16 rounded-lg p-6 border {dark ? 'bg-neutral-900/30 border-neutral-800' : 'bg-white border-gray-200'}">
      <h2 class="text-xs uppercase tracking-wide mb-4 {dark ? 'text-neutral-500' : 'text-gray-500'}">Bring Your Own Key</h2>
      <div class="grid md:grid-cols-2 gap-6">
        <div>
          <p class="mb-2 {dark ? 'text-neutral-300' : 'text-gray-900'}">Your OpenRouter API key = your compute spend. No markup.</p>
          <p class="text-sm {dark ? 'text-neutral-400' : 'text-gray-600'}">Access 100+ models (Claude, GPT-4, Gemini) through one key.</p>
        </div>
        <div class="flex flex-col justify-center">
          <a href="https://openrouter.ai/keys" class="text-sm transition-colors mb-1 {dark ? 'text-neutral-400 hover:text-neutral-300' : 'text-gray-600 hover:text-gray-900'}" target="_blank">
            Get a key at openrouter.ai/keys
          </a>
          <span class="text-xs {dark ? 'text-neutral-600' : 'text-gray-500'}">Then add it in Settings / Account</span>
        </div>
      </div>
    </section>

    <!-- How It Works -->
    <section class="mb-16">
      <h2 class="text-xs uppercase tracking-wide mb-6 {dark ? 'text-neutral-500' : 'text-gray-500'}">How It Works</h2>
      <div class="grid md:grid-cols-4 gap-4">
        <div class="relative">
          <div class="text-2xl font-medium mb-2 {dark ? 'text-neutral-700' : 'text-gray-300'}">01</div>
          <h3 class="font-medium mb-1 {dark ? 'text-neutral-200' : 'text-gray-900'}">Create Session</h3>
          <p class="text-sm {dark ? 'text-neutral-400' : 'text-gray-600'}">Like a project folder. Optional git repo to clone.</p>
        </div>
        <div class="relative">
          <div class="text-2xl font-medium mb-2 {dark ? 'text-neutral-700' : 'text-gray-300'}">02</div>
          <h3 class="font-medium mb-1 {dark ? 'text-neutral-200' : 'text-gray-900'}">Spawn Agent</h3>
          <p class="text-sm {dark ? 'text-neutral-400' : 'text-gray-600'}">Pick type, model, give it a name. Appears in tree.</p>
        </div>
        <div class="relative">
          <div class="text-2xl font-medium mb-2 {dark ? 'text-neutral-700' : 'text-gray-300'}">03</div>
          <h3 class="font-medium mb-1 {dark ? 'text-neutral-200' : 'text-gray-900'}">Chat & Watch</h3>
          <p class="text-sm {dark ? 'text-neutral-400' : 'text-gray-600'}">Send tasks. Watch code, commits, spawned helpers in real-time.</p>
        </div>
        <div class="relative">
          <div class="text-2xl font-medium mb-2 {dark ? 'text-neutral-700' : 'text-gray-300'}">04</div>
          <h3 class="font-medium mb-1 {dark ? 'text-neutral-200' : 'text-gray-900'}">Tree Grows</h3>
          <p class="text-sm {dark ? 'text-neutral-400' : 'text-gray-600'}">Agents spawn child agents. Workflow branches automatically.</p>
        </div>
      </div>
    </section>

    <!-- Final CTA -->
    <section class="text-center py-12 {dark ? 'border-t border-neutral-800' : 'border-t border-gray-200'}">
      <h2 class="text-xl mb-4 {dark ? 'text-neutral-200' : 'text-gray-900'}">Ready to orchestrate?</h2>
      <div class="flex flex-col sm:flex-row gap-3 justify-center">
        <a href="/signup" class="inline-flex items-center justify-center px-6 py-3 rounded font-medium transition-colors {dark ? 'bg-neutral-100 hover:bg-white text-neutral-950' : 'bg-gray-900 hover:bg-gray-800 text-white'}">
          Create free account
        </a>
        <a href="/agent-api" class="inline-flex items-center justify-center px-6 py-3 border rounded transition-colors {dark ? 'border-neutral-700 hover:border-neutral-500' : 'border-gray-300 hover:border-gray-400'}">
          API for agents
        </a>
      </div>
    </section>
  </main>

  <!-- Footer -->
  <footer class="px-6 py-8 text-center text-xs {dark ? 'border-t border-neutral-800 text-neutral-600' : 'border-t border-gray-200 text-gray-500'}">
    <div class="mb-2">myfilepath.com</div>
    <div class="space-x-3">
      <a href="https://github.com/acoyfellow/filepath" class="hover:underline {dark ? 'hover:text-neutral-300' : 'hover:text-gray-900'}">GitHub</a>
      <span class="{dark ? 'text-neutral-700' : 'text-gray-300'}">-</span>
      <a href="/docs" class="hover:underline {dark ? 'hover:text-neutral-300' : 'hover:text-gray-900'}">Docs</a>
      <span class="{dark ? 'text-neutral-700' : 'text-gray-300'}">-</span>
      <a href="/api/openapi.json" class="hover:underline {dark ? 'hover:text-neutral-300' : 'hover:text-gray-900'}">API</a>
    </div>
  </footer>
</div>
