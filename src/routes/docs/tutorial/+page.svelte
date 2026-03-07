<script lang="ts">
</script>

<svelte:head>
  <title>Getting Started Tutorial | filepath</title>
  <meta name="description" content="Learn filepath step-by-step. Create your first session, spawn an agent, and start chatting in 5 minutes." />
</svelte:head>

<div class="min-h-screen font-sans bg-gray-50 text-gray-700 dark:bg-neutral-950 dark:text-neutral-300 transition-colors duration-200">
<main class="max-w-3xl mx-auto px-6 py-12">
  <div class="mb-8">
    <a href="/docs" class="text-gray-500 dark:text-neutral-500 hover:text-neutral-300 text-sm">Back to Docs</a>
  </div>

  <h1 class="text-3xl font-medium text-gray-900 dark:text-neutral-100 mb-4">Getting Started Tutorial</h1>
  <p class="text-gray-600 dark:text-neutral-400 mb-12">Your first agent session in 5 minutes. No credit card required.</p>

  <!-- Step 1 -->
  <section class="mb-12">
    <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200 mb-4 flex items-center gap-3">
      <span class="w-8 h-8 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 flex items-center justify-center text-sm">1</span>
      Sign Up
    </h2>
    <p class="text-gray-600 dark:text-neutral-400 mb-4">Create a free account at <a href="/signup" class="text-gray-700 dark:text-neutral-300 hover:underline">myfilepath.com/signup</a>.</p>
    <p class="text-gray-600 dark:text-neutral-400">Just email and password. We send a welcome email with your verification code.</p>
  </section>

  <!-- Step 2 -->
  <section class="mb-12">
    <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200 mb-4 flex items-center gap-3">
      <span class="w-8 h-8 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 flex items-center justify-center text-sm">2</span>
      Add Your API Key
    </h2>
    <p class="text-gray-600 dark:text-neutral-400 mb-4">filepath is BYOK (Bring Your Own Key). We don't charge for AI usage—you pay the providers directly.</p>
    <ol class="space-y-2 text-gray-600 dark:text-neutral-400 list-decimal list-inside">
      <li>Get an OpenRouter key at <a href="https://openrouter.ai/keys" class="text-gray-700 dark:text-neutral-300 hover:underline" target="_blank">openrouter.ai/keys</a></li>
      <li>Or get an OpenCode Zen key at <a href="https://opencode.ai/zen" class="text-gray-700 dark:text-neutral-300 hover:underline" target="_blank">opencode.ai/zen</a></li>
      <li>Go to <a href="/settings/account" class="text-gray-700 dark:text-neutral-300 hover:underline">Settings / Account</a></li>
      <li>Paste your key (encrypted and stored securely)</li>
    </ol>
  </section>

  <!-- Step 3 -->
  <section class="mb-12">
    <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200 mb-4 flex items-center gap-3">
      <span class="w-8 h-8 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 flex items-center justify-center text-sm">3</span>
      Create a Session
    </h2>
    <p class="text-gray-600 dark:text-neutral-400 mb-4">A session is your workspace. Think of it like a project folder.</p>
    <ol class="space-y-2 text-gray-600 dark:text-neutral-400 list-decimal list-inside">
      <li>From the dashboard, click "New Session"</li>
      <li>Give it a name (e.g., "API Research")</li>
      <li>Optional: Add a git repo URL to clone</li>
    </ol>
  </section>

  <!-- Step 4 -->
  <section class="mb-12">
    <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200 mb-4 flex items-center gap-3">
      <span class="w-8 h-8 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 flex items-center justify-center text-sm">4</span>
      Spawn Your First Agent
    </h2>
    <p class="text-gray-600 dark:text-neutral-400 mb-4">Agents do the work. Start with Pi for research or Shelley for coding.</p>
    <ol class="space-y-2 text-gray-600 dark:text-neutral-400 list-decimal list-inside">
      <li>In your session, click "Spawn Agent"</li>
      <li>Pick an agent type (Pi, Shelley, Claude Code, etc.)</li>
      <li>Choose a model (Claude 4.5 or GPT-5 are solid starting points)</li>
      <li>Click "Spawn"</li>
    </ol>
    <p class="text-gray-500 dark:text-neutral-500 text-sm mt-4">The agent appears in the tree on the left. Click it to chat.</p>
  </section>

  <!-- Step 5 -->
  <section class="mb-12">
    <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200 mb-4 flex items-center gap-3">
      <span class="w-8 h-8 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 flex items-center justify-center text-sm">5</span>
      Start Chatting
    </h2>
    <p class="text-gray-600 dark:text-neutral-400 mb-4">Click on your agent in the tree to open the chat panel.</p>
    <ul class="space-y-2 text-gray-600 dark:text-neutral-400 list-disc list-inside">
      <li>Type a message and hit Enter</li>
      <li>Watch the agent think, use tools, and write files</li>
      <li>See real-time updates via WebSocket</li>
      <li>Agent state persists—even if you close the tab</li>
    </ul>
  </section>

  <!-- What's Next -->
  <section class="bg-neutral-900/50 border border-gray-200 dark:border-neutral-800 rounded-lg p-6 mb-12">
    <h2 class="text-lg font-medium text-gray-800 dark:text-neutral-200 mb-4">What's Next?</h2>
    <ul class="space-y-2 text-gray-600 dark:text-neutral-400">
      <li>• <a href="/docs/how-to/custom-agent" class="text-gray-700 dark:text-neutral-300 hover:underline">Build a custom agent</a> — Bring your own Docker container</li>
      <li>• <a href="/docs/explanation/architecture" class="text-gray-700 dark:text-neutral-300 hover:underline">Learn the architecture</a> — Understand how it all works</li>
      <li>• <a href="/agent-api" class="text-gray-700 dark:text-neutral-300 hover:underline">API Access</a> — Use filepath programmatically</li>
      <li>• Spawn child agents — Agents can spawn agents. Build workflows.</li>
    </ul>
  </section>

  <!-- Troubleshooting -->
  <section class="mb-12">
    <h2 class="text-lg font-medium text-gray-800 dark:text-neutral-200 mb-4">Troubleshooting</h2>
    
    <div class="space-y-4">
      <div class="border-l-2 border-neutral-700 pl-4">
        <h3 class="text-gray-700 dark:text-neutral-300 font-medium">"No API key set"</h3>
    <p class="text-gray-500 dark:text-neutral-500 text-sm">Add your OpenRouter or OpenCode Zen key in Settings / Account before spawning an agent.</p>
      </div>
      
      <div class="border-l-2 border-neutral-700 pl-4">
        <h3 class="text-gray-700 dark:text-neutral-300 font-medium">Agent shows "disconnected"</h3>
        <p class="text-gray-500 dark:text-neutral-500 text-sm">Refresh the page. WebSocket auto-reconnects. If still broken, check your API key is valid.</p>
      </div>
      
      <div class="border-l-2 border-neutral-700 pl-4">
        <h3 class="text-gray-700 dark:text-neutral-300 font-medium">Not getting responses</h3>
        <p class="text-gray-500 dark:text-neutral-500 text-sm">Check your router key is valid and has credits. Check the agent status in the tree sidebar.</p>
      </div>
    </div>
  </section>

  <footer class="border-t border-gray-200 dark:border-neutral-800 pt-6 text-center">
    <p class="text-gray-500 dark:text-neutral-500 text-sm">
      Need help? <a href="https://github.com/acoyfellow/filepath/discussions" class="text-gray-700 dark:text-neutral-300 hover:underline">Ask on GitHub</a>
    </p>
  </footer>
</main>
</div>
