<script lang="ts">
  import HeroDemo from '$lib/components/HeroDemo.svelte';
</script>

<svelte:head>
  <title>filepath — Run AI agents on the edge</title>
  <meta name="description" content="Persistent containers for AI agents. Minutes, hours, or days. Claude Code, Codex, Cursor, or your own. Runs on Cloudflare." />
</svelte:head>

<div class="min-h-screen font-sans relative z-10 transition-colors duration-200 bg-gray-50 text-gray-700 dark:bg-neutral-950 dark:text-neutral-300">
  <div class="min-h-screen z-0 absolute inset-0 pointer-events-none transition-colors duration-200 bg-white opacity-5 dark:bg-black dark:opacity-10">
    <img src="/bg.jpg" alt="Background" class="absolute inset-0 w-full h-full object-cover z-0"/>
    <div class="absolute bottom-0 left-0 w-full h-1/2 bg-linear-to-t from-gray-50 dark:from-neutral-950 to-transparent z-10"></div>
  </div>

  <main class="max-w-6xl mx-auto px-6 py-12 md:py-20">
    <!-- Hero: Simple and Grounded -->
    <div class="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start mb-16">
      <div class="lg:sticky lg:top-8">
        <h1 class="text-3xl md:text-4xl font-medium mb-4 leading-tight text-gray-900 dark:text-neutral-100">
          Run AI agents<br/>on the edge.
        </h1>
        
        <p class="mb-8 leading-relaxed text-lg text-gray-600 dark:text-neutral-400">
          Persistent containers that run for minutes, hours, or days. 
          Claude Code, Codex, Cursor, or your own. Switch models mid-session. 
          Close your laptop — they keep running.
        </p>
        
        <div class="flex flex-col sm:flex-row gap-3 mb-10">
          <a href="/signup" class="inline-flex items-center justify-center px-6 py-3 rounded font-medium transition-colors bg-gray-900 hover:bg-gray-800 text-white dark:bg-neutral-100 dark:hover:bg-white dark:text-neutral-950">
            Start executing
          </a>
          <a href="/docs" class="inline-flex items-center justify-center px-6 py-3 border rounded transition-colors border-gray-300 hover:border-gray-400 dark:border-neutral-700 dark:hover:border-neutral-500">
            Read the docs
          </a>
        </div>
        
        <div class="space-y-2 text-sm">
          <div class="flex items-start gap-2">
            <span class="text-green-600 dark:text-green-500/60 mt-0.5">→</span>
            <span class="text-gray-600 dark:text-neutral-400">Switch Claude → Codex → your container anytime</span>
          </div>
          <div class="flex items-start gap-2">
            <span class="text-green-600 dark:text-green-500/60 mt-0.5">→</span>
            <span class="text-gray-600 dark:text-neutral-400">Change models mid-session (claude-sonnet-4 → o3)</span>
          </div>
          <div class="flex items-start gap-2">
            <span class="text-green-600 dark:text-green-500/60 mt-0.5">→</span>
            <span class="text-gray-600 dark:text-neutral-400">Dashboard, API, WebSocket, or MCP — your choice</span>
          </div>
          <div class="flex items-start gap-2">
            <span class="text-green-600 dark:text-green-500/60 mt-0.5">→</span>
            <span class="text-gray-600 dark:text-neutral-400">Runs on Cloudflare. Your API key, your spend.</span>
          </div>
        </div>
      </div>
      
      <div class="@container w-full min-w-0">
        <HeroDemo />
      </div>
    </div>

    <!-- What You Get: Three Things -->
    <section class="mb-16">
      <h2 class="text-xs uppercase tracking-wide mb-6 text-gray-500 dark:text-neutral-500">What you get</h2>
      <div class="grid md:grid-cols-3 gap-5">
        <div class="rounded-lg p-5 border bg-white border-gray-200 dark:bg-neutral-900/50 dark:border-neutral-800">
          <h3 class="font-medium mb-2 text-gray-900 dark:text-neutral-200">Visual Tree</h3>
          <p class="text-sm text-gray-600 dark:text-neutral-400">See every agent's status at a glance. Hierarchy shows who's working on what. Click any node to chat.</p>
        </div>
        <div class="rounded-lg p-5 border bg-white border-gray-200 dark:bg-neutral-900/50 dark:border-neutral-800">
          <h3 class="font-medium mb-2 text-gray-900 dark:text-neutral-200">Rich Chat</h3>
          <p class="text-sm text-gray-600 dark:text-neutral-400">Watch tool calls, file writes, commits, and spawned agents appear inline. Real-time via WebSocket.</p>
        </div>
        <div class="rounded-lg p-5 border bg-white border-gray-200 dark:bg-neutral-900/50 dark:border-neutral-800">
          <h3 class="font-medium mb-2 text-gray-900 dark:text-neutral-200">Persistent State</h3>
          <p class="text-sm text-gray-600 dark:text-neutral-400">Close your laptop, reopen on your phone — same tree, same conversations. Agents keep working.</p>
        </div>
      </div>
    </section>

    <!-- How It Works -->
    <section class="mb-16">
      <h2 class="text-xs uppercase tracking-wide mb-6 text-gray-500 dark:text-neutral-500">How it works</h2>
      <div class="grid md:grid-cols-4 gap-4">
        <div>
          <div class="text-2xl font-medium mb-2 text-gray-300 dark:text-neutral-700">01</div>
          <h3 class="font-medium mb-1 text-gray-900 dark:text-neutral-200">Create Session</h3>
          <p class="text-sm text-gray-600 dark:text-neutral-400">Like a project folder. Optional git repo to clone.</p>
        </div>
        <div>
          <div class="text-2xl font-medium mb-2 text-gray-300 dark:text-neutral-700">02</div>
          <h3 class="font-medium mb-1 text-gray-900 dark:text-neutral-200">Spawn Agent</h3>
          <p class="text-sm text-gray-600 dark:text-neutral-400">Pick type, model, give it a name. Appears in tree.</p>
        </div>
        <div>
          <div class="text-2xl font-medium mb-2 text-gray-300 dark:text-neutral-700">03</div>
          <h3 class="font-medium mb-1 text-gray-900 dark:text-neutral-200">Chat & Watch</h3>
          <p class="text-sm text-gray-600 dark:text-neutral-400">Send tasks. Watch code, commits, spawned helpers in real-time.</p>
        </div>
        <div>
          <div class="text-2xl font-medium mb-2 text-gray-300 dark:text-neutral-700">04</div>
          <h3 class="font-medium mb-1 text-gray-900 dark:text-neutral-200">Tree Grows</h3>
          <p class="text-sm text-gray-600 dark:text-neutral-400">Agents spawn child agents. Workflow branches automatically.</p>
        </div>
      </div>
    </section>

    <!-- BYOK -->
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
          <span class="text-xs text-gray-500 dark:text-neutral-600">Then add it in Settings → API Keys</span>
        </div>
      </div>
    </section>

    <!-- CTA -->
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
      <span class="text-gray-300 dark:text-neutral-700">·</span>
      <a href="/docs" class="hover:underline hover:text-gray-900 dark:hover:text-neutral-300">Docs</a>
      <span class="text-gray-300 dark:text-neutral-700">·</span>
      <a href="/api/openapi.json" class="hover:underline hover:text-gray-900 dark:hover:text-neutral-300">API</a>
    </div>
  </footer>
</div>
