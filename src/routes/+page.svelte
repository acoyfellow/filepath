<script lang="ts">
  import HeroDemo from '$lib/components/HeroDemo.svelte';
</script>

<svelte:head>
  <title>filepath - Orchestration Layer for AI Agents</title>
  <meta name="description" content="The infrastructure for coordinating AI agents. Liquid agents, liquid models. Dashboard, API, or TypeScript — however you orchestrate." />
</svelte:head>

<div class="min-h-screen font-sans relative z-10 transition-colors duration-200 bg-gray-50 text-gray-700 dark:bg-neutral-950 dark:text-neutral-300">
  <div class="min-h-screen z-0 absolute inset-0 pointer-events-none transition-colors duration-200 bg-white opacity-5 dark:bg-black dark:opacity-10">
    <img src="/bg.jpg" alt="Background" class="absolute inset-0 w-full h-full object-cover z-0"/>
    <div class="absolute bottom-0 left-0 w-full h-1/2 bg-linear-to-t from-gray-50 dark:from-neutral-950 to-transparent z-10"></div>
  </div>

  <main class="max-w-6xl mx-auto px-6 py-12 md:py-20">
    <!-- Hero Section: Infrastructure positioning -->
    <div class="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start mb-20 [&>*:nth-child(2)]:min-w-0">
      <!-- Left: Infrastructure Value Prop -->
      <div class="lg:sticky lg:top-8">
        <h1 class="text-3xl md:text-4xl font-medium mb-4 leading-tight text-gray-900 dark:text-neutral-100">
          Orchestration layer for AI agents.
        </h1>
        
        <p class="mb-8 leading-relaxed text-lg text-gray-600 dark:text-neutral-400">
          Agents are <span class="text-gray-900 dark:text-neutral-200 font-medium">interchangeable</span>. 
          Models are <span class="text-gray-900 dark:text-neutral-200 font-medium">interchangeable</span>. 
          We provide the infrastructure to coordinate them.
        </p>
        
        <div class="flex flex-col sm:flex-row gap-3 mb-8">
          <a href="/signup" class="inline-flex items-center justify-center px-6 py-3 rounded font-medium transition-colors bg-gray-900 hover:bg-gray-800 text-white dark:bg-neutral-100 dark:hover:bg-white dark:text-neutral-950">
            Start executing
          </a>
          <a href="/docs" class="inline-flex items-center justify-center px-6 py-3 border rounded transition-colors border-gray-300 hover:border-gray-400 dark:border-neutral-700 dark:hover:border-neutral-500">
            View API docs
          </a>
        </div>
        
        <!-- Access patterns -->
        <div class="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-neutral-500">
          <span class="px-2 py-1 rounded border border-gray-200 dark:border-neutral-800">Dashboard</span>
          <span class="px-2 py-1 rounded border border-gray-200 dark:border-neutral-800">REST API</span>
          <span class="px-2 py-1 rounded border border-gray-200 dark:border-neutral-800">WebSocket</span>
          <span class="px-2 py-1 rounded border border-gray-200 dark:border-neutral-800">MCP</span>
          <span class="px-2 py-1 rounded border border-gray-200 dark:border-neutral-800">TypeScript</span>
        </div>
      </div>
      
      <!-- Right: Live Demo -->
      <div class="@container lg:mt-0 w-full min-w-0">
        <HeroDemo />
      </div>
    </div>

    <!-- Liquid Primitives: The Core USP -->
    <section class="mb-20">
      <h2 class="text-xs uppercase tracking-wide mb-8 text-gray-500 dark:text-neutral-500">Liquid Primitives</h2>
      <div class="grid md:grid-cols-2 gap-6">
        <!-- Liquid Agents -->
        <div class="rounded-lg p-6 border bg-white border-gray-200 dark:bg-neutral-900/50 dark:border-neutral-800">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-lg bg-gray-100 dark:bg-neutral-800 flex items-center justify-center">
              <svg class="w-5 h-5 text-gray-600 dark:text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
            </div>
            <h3 class="font-medium text-lg text-gray-900 dark:text-neutral-200">Liquid Agents</h3>
          </div>
          <p class="text-sm text-gray-600 dark:text-neutral-400 mb-4">
            Swap agents without changing your workflow. Claude Code → Codex → Shelley → your custom container. 
            Same protocol, seamless handoff.
          </p>
          <div class="flex flex-wrap gap-2 text-xs">
            <span class="text-gray-500 dark:text-neutral-500">Claude Code</span>
            <span class="text-gray-300 dark:text-neutral-700">→</span>
            <span class="text-gray-500 dark:text-neutral-500">Codex</span>
            <span class="text-gray-300 dark:text-neutral-700">→</span>
            <span class="text-gray-500 dark:text-neutral-500">Cursor</span>
            <span class="text-gray-300 dark:text-neutral-700">→</span>
            <span class="text-gray-500 dark:text-neutral-500">BYO Container</span>
          </div>
        </div>

        <!-- Liquid Models -->
        <div class="rounded-lg p-6 border bg-white border-gray-200 dark:bg-neutral-900/50 dark:border-neutral-800">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-lg bg-gray-100 dark:bg-neutral-800 flex items-center justify-center">
              <svg class="w-5 h-5 text-gray-600 dark:text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <h3 class="font-medium text-lg text-gray-900 dark:text-neutral-200">Liquid Models</h3>
          </div>
          <p class="text-sm text-gray-600 dark:text-neutral-400 mb-4">
            Switch models mid-session. Start with Claude Sonnet for speed, escalate to o3 for reasoning, 
            fallback to Gemini for cost. Same agent, different brain.
          </p>
          <div class="flex flex-wrap gap-2 text-xs">
            <span class="text-gray-500 dark:text-neutral-500">claude-sonnet-4</span>
            <span class="text-gray-300 dark:text-neutral-700">→</span>
            <span class="text-gray-500 dark:text-neutral-500">o3</span>
            <span class="text-gray-300 dark:text-neutral-700">→</span>
            <span class="text-gray-500 dark:text-neutral-500">gemini-2.5-pro</span>
            <span class="text-gray-300 dark:text-neutral-700">→</span>
            <span class="text-gray-500 dark:text-neutral-500">100+ more</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Orchestration Interfaces: How you access it -->
    <section class="mb-20">
      <h2 class="text-xs uppercase tracking-wide mb-8 text-gray-500 dark:text-neutral-500">Orchestration Interfaces</h2>
      <div class="grid md:grid-cols-3 gap-4">
        <div class="rounded-lg p-5 border bg-white border-gray-200 dark:bg-neutral-900/50 dark:border-neutral-800">
          <div class="flex items-center gap-2 mb-3">
            <svg class="w-4 h-4 text-gray-500 dark:text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
            </svg>
            <h3 class="font-medium text-gray-900 dark:text-neutral-200">Dashboard</h3>
          </div>
          <p class="text-sm text-gray-600 dark:text-neutral-400">
            Visual tree, rich chat, human-in-the-loop control. See every agent's status at a glance.
          </p>
        </div>

        <div class="rounded-lg p-5 border bg-white border-gray-200 dark:bg-neutral-900/50 dark:border-neutral-800">
          <div class="flex items-center gap-2 mb-3">
            <svg class="w-4 h-4 text-gray-500 dark:text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
            </svg>
            <h3 class="font-medium text-gray-900 dark:text-neutral-200">API</h3>
          </div>
          <p class="text-sm text-gray-600 dark:text-neutral-400">
            REST + WebSocket for your own applications. Spawn agents, send messages, receive events.
          </p>
        </div>

        <div class="rounded-lg p-5 border bg-white border-gray-200 dark:bg-neutral-900/50 dark:border-neutral-800">
          <div class="flex items-center gap-2 mb-3">
            <svg class="w-4 h-4 text-gray-500 dark:text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <h3 class="font-medium text-gray-900 dark:text-neutral-200">MCP + TypeScript</h3>
          </div>
          <p class="text-sm text-gray-600 dark:text-neutral-400">
            Agents calling agents. Spawn, delegate, monitor programmatically. Build autonomous workflows.
          </p>
        </div>
      </div>
    </section>

    <!-- What You Get (condensed features) -->
    <section class="mb-16">
      <h2 class="text-xs uppercase tracking-wide mb-6 text-gray-500 dark:text-neutral-500">What You Get</h2>
      <div class="grid md:grid-cols-3 gap-4">
        <div class="rounded-lg p-5 border bg-white border-gray-200 dark:bg-neutral-900/50 dark:border-neutral-800">
          <h3 class="font-medium mb-2 text-gray-900 dark:text-neutral-200">Visual Tree</h3>
          <p class="text-sm text-gray-600 dark:text-neutral-400">See all your agents at a glance. Running, idle, done — status is obvious. Hierarchy shows who's working on what.</p>
        </div>
        <div class="rounded-lg p-5 border bg-white border-gray-200 dark:bg-neutral-900/50 dark:border-neutral-800">
          <h3 class="font-medium mb-2 text-gray-900 dark:text-neutral-200">Rich Chat</h3>
          <p class="text-sm text-gray-600 dark:text-neutral-400">Not just text. Watch tool calls, file writes, commits, and spawned agents appear inline. Real-time via WebSocket.</p>
        </div>
        <div class="rounded-lg p-5 border bg-white border-gray-200 dark:bg-neutral-900/50 dark:border-neutral-800">
          <h3 class="font-medium mb-2 text-gray-900 dark:text-neutral-200">Persistent State</h3>
          <p class="text-sm text-gray-600 dark:text-neutral-400">Close your laptop, reopen on your phone — same tree, same conversations. Agents continue working while you're away.</p>
        </div>
      </div>
    </section>

    <!-- How It Works (condensed) -->
    <section class="mb-16">
      <h2 class="text-xs uppercase tracking-wide mb-6 text-gray-500 dark:text-neutral-500">How It Works</h2>
      <div class="grid md:grid-cols-4 gap-4">
        <div class="relative">
          <div class="text-2xl font-medium mb-2 text-gray-300 dark:text-neutral-700">01</div>
          <h3 class="font-medium mb-1 text-gray-900 dark:text-neutral-200">Create Session</h3>
          <p class="text-sm text-gray-600 dark:text-neutral-400">Like a project folder. Optional git repo to clone.</p>
        </div>
        <div class="relative">
          <div class="text-2xl font-medium mb-2 text-gray-300 dark:text-neutral-700">02</div>
          <h3 class="font-medium mb-1 text-gray-900 dark:text-neutral-200">Spawn Agent</h3>
          <p class="text-sm text-gray-600 dark:text-neutral-400">Pick type, model, give it a name. Appears in tree.</p>
        </div>
        <div class="relative">
          <div class="text-2xl font-medium mb-2 text-gray-300 dark:text-neutral-700">03</div>
          <h3 class="font-medium mb-1 text-gray-900 dark:text-neutral-200">Chat & Watch</h3>
          <p class="text-sm text-gray-600 dark:text-neutral-400">Send tasks. Watch code, commits, spawned helpers in real-time.</p>
        </div>
        <div class="relative">
          <div class="text-2xl font-medium mb-2 text-gray-300 dark:text-neutral-700">04</div>
          <h3 class="font-medium mb-1 text-gray-900 dark:text-neutral-200">Tree Grows</h3>
          <p class="text-sm text-gray-600 dark:text-neutral-400">Agents spawn child agents. Workflow branches automatically.</p>
        </div>
      </div>
    </section>

    <!-- BYOK Model -->
    <section class="mb-16 rounded-lg p-6 border bg-white border-gray-200 dark:bg-neutral-900/30 dark:border-neutral-800">
      <h2 class="text-xs uppercase tracking-wide mb-4 text-gray-500 dark:text-neutral-500">Bring Your Own Key</h2>
      <div class="grid md:grid-cols-2 gap-6">
        <div>
          <p class="mb-2 text-gray-900 dark:text-neutral-300">Your OpenRouter API key = your compute spend. No markup.</p>
          <p class="text-sm text-gray-600 dark:text-neutral-400">Access 100+ models (Claude, GPT-4, Gemini) through one key.</p>
        </div>
        <div class="flex flex-col justify-center">
          <a href="https://openrouter.ai/keys" class="text-sm transition-colors mb-1 text-gray-600 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-neutral-300" target="_blank">
            Get a key at openrouter.ai/keys
          </a>
          <span class="text-xs text-gray-500 dark:text-neutral-600">Then add it in Settings / Account</span>
        </div>
      </div>
    </section>

    <!-- Final CTA -->
    <section class="text-center py-12 border-t border-gray-200 dark:border-neutral-800">
      <h2 class="text-xl mb-4 text-gray-900 dark:text-neutral-200">Ready to orchestrate?</h2>
      <div class="flex flex-col sm:flex-row gap-3 justify-center">
        <a href="/signup" class="inline-flex items-center justify-center px-6 py-3 rounded font-medium transition-colors bg-gray-900 hover:bg-gray-800 text-white dark:bg-neutral-100 dark:hover:bg-white dark:text-neutral-950">
          Create free account
        </a>
        <a href="/agent-api" class="inline-flex items-center justify-center px-6 py-3 border rounded transition-colors border-gray-300 hover:border-gray-400 dark:border-neutral-700 dark:hover:border-neutral-500">
          API for agents
        </a>
      </div>
    </section>
  </main>

  <!-- Footer -->
  <footer class="px-6 py-8 text-center text-xs border-t border-gray-200 text-gray-500 dark:border-neutral-800 dark:text-neutral-600">
    <div class="mb-2">myfilepath.com</div>
    <div class="space-x-3">
      <a href="https://github.com/acoyfellow/filepath" class="hover:underline hover:text-gray-900 dark:hover:text-neutral-300">GitHub</a>
      <span class="text-gray-300 dark:text-neutral-700">-</span>
      <a href="/docs" class="hover:underline hover:text-gray-900 dark:hover:text-neutral-300">Docs</a>
      <span class="text-gray-300 dark:text-neutral-700">-</span>
      <a href="/api/openapi.json" class="hover:underline hover:text-gray-900 dark:hover:text-neutral-300">API</a>
    </div>
  </footer>
</div>
