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
  <title>Documentation | filepath</title>
  <meta name="description" content="Learn how to use filepath: agent orchestration platform with tree-structured conversations, real-time chat, and bring-your-own-key model." />
</svelte:head>

<div class="min-h-screen font-sans {dark ? 'bg-neutral-950 text-neutral-300' : 'bg-gray-50 text-gray-700'} transition-colors duration-200">
  <Nav />

  <main class="max-w-4xl mx-auto px-6 py-12">
  <h1 class="{dark ? 'text-neutral-100' : 'text-gray-900'} text-3xl font-medium mb-4">Documentation</h1>
  <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} mb-12 max-w-2xl">Learn how to orchestrate agents on filepath. Tree of agents on the left, rich chat on the right. BYOK model.</p>

  <!-- Documentation Types Grid -->
  <div class="grid gap-6 md:grid-cols-2 mb-12">
    <!-- Tutorials -->
    <a href="/docs/tutorial" class="block {dark ? 'bg-neutral-900' : 'bg-white'} border {dark ? 'border-neutral-800' : 'border-gray-200'} rounded-lg p-6 hover:border-neutral-700 transition-colors">
      <div class="flex items-center gap-3 mb-3">
        <span class="text-2xl">GS</span>
        <h2 class="text-xl font-medium {dark ? 'text-neutral-200' : 'text-gray-800'}">Tutorial</h2>
      </div>
      <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} text-sm mb-4">Learning-oriented. Get started with your first agent step-by-step.</p>
      <span class="{dark ? 'text-neutral-500' : 'text-gray-500'} text-sm">Getting Started</span>
    </a>

    <!-- How-To Guides -->
    <a href="/docs/how-to" class="block {dark ? 'bg-neutral-900' : 'bg-white'} border {dark ? 'border-neutral-800' : 'border-gray-200'} rounded-lg p-6 hover:border-neutral-700 transition-colors">
      <div class="flex items-center gap-3 mb-3">
        <span class="text-2xl">HW</span>
        <h2 class="text-xl font-medium {dark ? 'text-neutral-200' : 'text-gray-800'}">How-To Guides</h2>
      </div>
      <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} text-sm mb-4">Task-oriented. Solve specific problems: custom agents, debugging, configuration.</p>
      <span class="{dark ? 'text-neutral-500' : 'text-gray-500'} text-sm">View Guides</span>
    </a>

    <!-- Explanation -->
    <a href="/docs/explanation/architecture" class="block {dark ? 'bg-neutral-900' : 'bg-white'} border {dark ? 'border-neutral-800' : 'border-gray-200'} rounded-lg p-6 hover:border-neutral-700 transition-colors">
      <div class="flex items-center gap-3 mb-3">
        <span class="text-2xl">EX</span>
        <h2 class="text-xl font-medium {dark ? 'text-neutral-200' : 'text-gray-800'}">Explanation</h2>
      </div>
      <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} text-sm mb-4">Understanding-oriented. Deep dives into architecture and protocol.</p>
      <span class="{dark ? 'text-neutral-500' : 'text-gray-500'} text-sm">Architecture</span>
    </a>

    <!-- Reference -->
    <a href="/docs/reference/api" class="block {dark ? 'bg-neutral-900' : 'bg-white'} border {dark ? 'border-neutral-800' : 'border-gray-200'} rounded-lg p-6 hover:border-neutral-700 transition-colors">
      <div class="flex items-center gap-3 mb-3">
        <span class="text-2xl">RF</span>
        <h2 class="text-xl font-medium {dark ? 'text-neutral-200' : 'text-gray-800'}">Reference</h2>
      </div>
      <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} text-sm mb-4">Information-oriented. API endpoints, protocol spec, agent catalog.</p>
      <span class="{dark ? 'text-neutral-500' : 'text-gray-500'} text-sm">API Reference</span>
    </a>
  </div>

  <!-- Quick Links -->
  <section class="mb-12">
    <h2 class="{dark ? 'text-neutral-100' : 'text-gray-900'} text-lg mb-6">Quick Links</h2>
    <div class="grid gap-4 md:grid-cols-3">
      <a href="/docs/how-to/custom-agent" class="{dark ? 'text-neutral-400' : 'text-gray-600'} hover:text-neutral-200 text-sm">
        Build Custom Agent
      </a>
      <a href="/docs/how-to/debug-containers" class="{dark ? 'text-neutral-400' : 'text-gray-600'} hover:text-neutral-200 text-sm">
        Debug Failures
      </a>
      <a href="/docs/how-to/per-session-keys" class="{dark ? 'text-neutral-400' : 'text-gray-600'} hover:text-neutral-200 text-sm">
        Per-Session Keys
      </a>
      <a href="/docs/explanation/protocol" class="{dark ? 'text-neutral-400' : 'text-gray-600'} hover:text-neutral-200 text-sm">
        FAP Protocol
      </a>
      <a href="https://github.com/acoyfellow/filepath/blob/main/llms.txt" class="{dark ? 'text-neutral-400' : 'text-gray-600'} hover:text-neutral-200 text-sm">
        llms.txt (for AI)
      </a>
      <a href="https://github.com/acoyfellow/filepath" class="{dark ? 'text-neutral-400' : 'text-gray-600'} hover:text-neutral-200 text-sm">
        GitHub Repo
      </a>
    </div>
  </section>

  <!-- Core Concepts -->
  <section class="mb-12">
    <h2 class="{dark ? 'text-neutral-100' : 'text-gray-900'} text-lg mb-6">Core Concepts</h2>
    <div class="space-y-4">
      <div class="{dark ? 'bg-neutral-900' : 'bg-white'} border {dark ? 'border-neutral-800' : 'border-gray-200'} rounded-lg p-4">
        <h3 class="{dark ? 'text-neutral-200' : 'text-gray-800'} font-medium mb-2">Sessions</h3>
        <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} text-sm">A persistent workspace for your agents. Contains a tree of agent nodes, each with its own conversation history and container.</p>
      </div>
      
      <div class="{dark ? 'bg-neutral-900' : 'bg-white'} border {dark ? 'border-neutral-800' : 'border-gray-200'} rounded-lg p-4">
        <h3 class="{dark ? 'text-neutral-200' : 'text-gray-800'} font-medium mb-2">Agent Tree</h3>
        <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} text-sm">Agents can spawn child agents. Visual tree on the left sidebar. Click any node to see its conversation. Parent and children work in parallel.</p>
      </div>
      
      <div class="{dark ? 'bg-neutral-900' : 'bg-white'} border {dark ? 'border-neutral-800' : 'border-gray-200'} rounded-lg p-4">
        <h3 class="{dark ? 'text-neutral-200' : 'text-gray-800'} font-medium mb-2">BYOK Model</h3>
        <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} text-sm">Bring Your Own Key. You provide API keys (OpenRouter, OpenAI, Anthropic); we provide the infrastructure. Your keys, your spend.</p>
      </div>
      
      <div class="{dark ? 'bg-neutral-900' : 'bg-white'} border {dark ? 'border-neutral-800' : 'border-gray-200'} rounded-lg p-4">
        <h3 class="{dark ? 'text-neutral-200' : 'text-gray-800'} font-medium mb-2">Real-Time Chat</h3>
        <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} text-sm">WebSocket connection to each agent. See tool calls, file writes, commits as they happen. Close laptop, open phone — same state.</p>
      </div>
    </div>
  </section>

  <!-- Getting Help -->
  <section class="bg-neutral-900/50 border {dark ? 'border-neutral-800' : 'border-gray-200'} rounded-lg p-6">
    <h2 class="{dark ? 'text-neutral-200' : 'text-gray-800'} text-lg mb-4">Need Help?</h2>
    <ul class="space-y-2 text-sm">
      <li class="{dark ? 'text-neutral-400' : 'text-gray-600'}">
        • <a href="https://github.com/acoyfellow/filepath/discussions" class="{dark ? 'text-neutral-300' : 'text-gray-700'} hover:underline">GitHub Discussions</a> — Ask questions, share ideas
      </li>
      <li class="{dark ? 'text-neutral-400' : 'text-gray-600'}">
        • <a href="https://github.com/acoyfellow/filepath/issues" class="{dark ? 'text-neutral-300' : 'text-gray-700'} hover:underline">GitHub Issues</a> — Report bugs, request features
      </li>
      <li class="{dark ? 'text-neutral-400' : 'text-gray-600'}">
        • <a href="https://myfilepath.com" class="{dark ? 'text-neutral-300' : 'text-gray-700'} hover:underline">myfilepath.com</a> — Try it out
      </li>
    </ul>
  </section>
  </main>

  <footer class="border-t {dark ? 'border-neutral-800' : 'border-gray-200'} px-6 py-6 text-center {dark ? 'text-neutral-600' : 'text-gray-400'} text-xs font-mono">
    myfilepath.com
  </footer>
</div>
