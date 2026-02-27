<script lang="ts">
  import Nav from '$lib/components/Nav.svelte';
  import HeroDemo from '$lib/components/HeroDemo.svelte';
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

  <main class="max-w-6xl mx-auto px-6 py-12 md:py-20">
    <!-- Hero Section: Text + Demo -->
    <div class="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start mb-16">
      <!-- Left: Value Prop -->
      <div class="lg:sticky lg:top-8">
        <h1 class="text-neutral-100 text-3xl md:text-4xl font-medium mb-4 leading-tight">
          Orchestrate AI coding agents in persistent containers.
        </h1>
        
        <p class="mb-8 leading-relaxed text-lg text-neutral-400">
          Spawn agents. Watch them work in parallel. The tree visualizes everything.
        </p>
        
        <div class="flex flex-col sm:flex-row gap-3 mb-8">
          <a href="/signup" class="inline-flex items-center justify-center px-6 py-3 bg-neutral-100 hover:bg-white text-neutral-950 rounded font-medium transition-colors">
            Start executing
          </a>
          <a href="/docs" class="inline-flex items-center justify-center px-6 py-3 border border-neutral-700 hover:border-neutral-500 rounded transition-colors">
            Read the docs
          </a>
        </div>
        
        <!-- Quick value props -->
        <div class="space-y-2 text-sm">
          <div class="flex items-center gap-2">
            <span class="text-green-500/60">-</span>
            <span class="text-neutral-400">Tree shows every agent's status</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-green-500/60">-</span>
            <span class="text-neutral-400">Click any agent to chat</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-green-500/60">-</span>
            <span class="text-neutral-400">Agents spawn child agents automatically</span>
          </div>
        </div>
      </div>
      
      <!-- Right: Live Demo -->
      <div class="lg:mt-0">
        <HeroDemo />
        <p class="text-center text-xs text-neutral-500 mt-3">
          This is the actual interface. Click agents in the tree to switch conversations.
        </p>
      </div>
    </div>

    <!-- Features Grid -->
    <section class="mb-16">
      <h2 class="text-neutral-500 text-xs uppercase tracking-wide mb-6">What You Get</h2>
      <div class="grid md:grid-cols-3 gap-4">
        <div class="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5">
          <h3 class="text-neutral-200 font-medium mb-2">Visual Tree</h3>
          <p class="text-sm text-neutral-400">See all your agents at a glance. Running, idle, done — status is obvious. Hierarchy shows who's working on what.</p>
        </div>
        <div class="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5">
          <h3 class="text-neutral-200 font-medium mb-2">Rich Chat</h3>
          <p class="text-sm text-neutral-400">Not just text. Watch tool calls, file writes, commits, and spawned agents appear inline. Real-time via WebSocket.</p>
        </div>
        <div class="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5">
          <h3 class="text-neutral-200 font-medium mb-2">Persistent State</h3>
          <p class="text-sm text-neutral-400">Close your laptop, reopen on your phone — same tree, same conversations. Agents continue working while you're away.</p>
        </div>
      </div>
    </section>

    <!-- Built-in Agents -->
    <section class="mb-16">
      <h2 class="text-neutral-500 text-xs uppercase tracking-wide mb-6">Built-in Agents</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div class="bg-neutral-900 border border-neutral-800 rounded p-4 hover:border-neutral-700 transition-colors">
          <span class="text-neutral-200 font-medium block">Shelley</span>
          <span class="text-neutral-500 text-xs">Full-stack engineering</span>
        </div>
        <div class="bg-neutral-900 border border-neutral-800 rounded p-4 hover:border-neutral-700 transition-colors">
          <span class="text-neutral-200 font-medium block">Pi</span>
          <span class="text-neutral-500 text-xs">Research and analysis</span>
        </div>
        <div class="bg-neutral-900 border border-neutral-800 rounded p-4 hover:border-neutral-700 transition-colors">
          <span class="text-neutral-200 font-medium block">Claude Code</span>
          <span class="text-neutral-500 text-xs">Multi-file changes</span>
        </div>
        <div class="bg-neutral-900 border border-neutral-800 rounded p-4 hover:border-neutral-700 transition-colors">
          <span class="text-neutral-200 font-medium block">Codex</span>
          <span class="text-neutral-500 text-xs">Python and data</span>
        </div>
      </div>
      <p class="text-neutral-500 text-sm mt-4">
        Plus: Cursor, Amp, OpenCode. Or bring your own Docker container.
        <a href="/docs/agents" class="text-neutral-400 hover:underline ml-1">View all agents</a>
      </p>
    </section>

    <!-- BYOK Model -->
    <section class="mb-16 bg-neutral-900/30 border border-neutral-800 rounded-lg p-6">
      <h2 class="text-neutral-500 text-xs uppercase tracking-wide mb-4">Bring Your Own Key</h2>
      <div class="grid md:grid-cols-2 gap-6">
        <div>
          <p class="text-neutral-300 mb-2">Your OpenRouter API key = your compute spend. No markup.</p>
          <p class="text-sm text-neutral-400">Access 100+ models (Claude, GPT-4, Gemini) through one key.</p>
        </div>
        <div class="flex flex-col justify-center">
          <a href="https://openrouter.ai/keys" class="text-sm text-neutral-400 hover:text-neutral-300 transition-colors mb-1" target="_blank">
            Get a key at openrouter.ai/keys
          </a>
          <span class="text-xs text-neutral-600">Then add it in Settings / Account</span>
        </div>
      </div>
    </section>

    <!-- How It Works -->
    <section class="mb-16">
      <h2 class="text-neutral-500 text-xs uppercase tracking-wide mb-6">How It Works</h2>
      <div class="grid md:grid-cols-4 gap-4">
        <div class="relative">
          <div class="text-2xl font-medium text-neutral-700 mb-2">01</div>
          <h3 class="text-neutral-200 font-medium mb-1">Create Session</h3>
          <p class="text-sm text-neutral-400">Like a project folder. Optional git repo to clone.</p>
        </div>
        <div class="relative">
          <div class="text-2xl font-medium text-neutral-700 mb-2">02</div>
          <h3 class="text-neutral-200 font-medium mb-1">Spawn Agent</h3>
          <p class="text-sm text-neutral-400">Pick type, model, give it a name. Appears in tree.</p>
        </div>
        <div class="relative">
          <div class="text-2xl font-medium text-neutral-700 mb-2">03</div>
          <h3 class="text-neutral-200 font-medium mb-1">Chat & Watch</h3>
          <p class="text-sm text-neutral-400">Send tasks. Watch code, commits, spawned helpers in real-time.</p>
        </div>
        <div class="relative">
          <div class="text-2xl font-medium text-neutral-700 mb-2">04</div>
          <h3 class="text-neutral-200 font-medium mb-1">Tree Grows</h3>
          <p class="text-sm text-neutral-400">Agents spawn child agents. Workflow branches automatically.</p>
        </div>
      </div>
    </section>

    <!-- Final CTA -->
    <section class="text-center py-12 border-t border-neutral-800">
      <h2 class="text-xl text-neutral-200 mb-4">Ready to orchestrate?</h2>
      <div class="flex flex-col sm:flex-row gap-3 justify-center">
        <a href="/signup" class="inline-flex items-center justify-center px-6 py-3 bg-neutral-100 hover:bg-white text-neutral-950 rounded font-medium transition-colors">
          Create free account
        </a>
        <a href="/agent-api" class="inline-flex items-center justify-center px-6 py-3 border border-neutral-700 hover:border-neutral-500 rounded transition-colors">
          API for agents
        </a>
      </div>
    </section>
  </main>

  <!-- Footer -->
  <footer class="border-t border-neutral-800 px-6 py-8 text-center text-neutral-600 text-xs">
    <div class="mb-2">myfilepath.com</div>
    <div class="space-x-3">
      <a href="https://github.com/acoyfellow/filepath" class="hover:text-neutral-300 transition-colors">GitHub</a>
      <span class="text-neutral-700">-</span>
      <a href="/docs" class="hover:text-neutral-300 transition-colors">Docs</a>
      <span class="text-neutral-700">-</span>
      <a href="/api/openapi.json" class="hover:text-neutral-300 transition-colors">API</a>
    </div>
  </footer>
</div>
