<script lang="ts">
  import { browser } from '$app/environment';
  import Nav from '$lib/components/Nav.svelte';
  import CodeBlock from '$lib/components/CodeBlock.svelte';

  let dark = $state(browser && document.documentElement.classList.contains('dark'));

  if (browser) {
    const observer = new MutationObserver(() => {
      dark = document.documentElement.classList.contains('dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }
</script>

<svelte:head>
  <title>Agent Catalog | filepath</title>
  <meta name="description" content="Available agents on filepath: Shelley, Pi, Claude Code, Codex, Cursor, Amp, OpenCode, and custom agents." />
</svelte:head>

<div class="min-h-screen font-sans {dark ? 'bg-neutral-950 text-neutral-300' : 'bg-gray-50 text-gray-700'} transition-colors duration-200">
  <Nav />

<main class="max-w-3xl mx-auto px-6 py-12">
  <div class="mb-8">
    <a href="/docs" class="{dark ? 'text-neutral-500' : 'text-gray-500'} hover:text-neutral-300 text-sm">Back to Docs</a>
  </div>

  <h1 class="text-3xl font-medium {dark ? 'text-neutral-100' : 'text-gray-900'} mb-4">Agent Catalog</h1>
  <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} mb-12">Available agents you can spawn.</p>

  <div class="space-y-6">
    <!-- Shelley -->
    <div class="{dark ? 'bg-neutral-900' : 'bg-white'} border {dark ? 'border-neutral-800' : 'border-gray-200'} rounded-lg p-6">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded {dark ? 'bg-neutral-800' : 'bg-gray-100'} flex items-center justify-center text-2xl">Sh</div>
        <div class="flex-1">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-xl font-medium {dark ? 'text-neutral-200' : 'text-gray-800'}">Shelley</h2>
            <code class="text-xs {dark ? 'bg-neutral-800' : 'bg-gray-100'} {dark ? 'text-neutral-300' : 'text-gray-700'} px-2 py-1 rounded">shelley</code>
          </div>
          <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} mb-3">Full-stack engineering agent. filepath-native reference implementation.</p>
          <div class="flex gap-2 text-sm">
            <span class="{dark ? 'text-neutral-500' : 'text-gray-500'}">Default model:</span>
            <code class="{dark ? 'text-neutral-400' : 'text-gray-600'}">anthropic/claude-sonnet-4</code>
          </div>
        </div>
      </div>
    </div>

    <!-- Pi -->
    <div class="{dark ? 'bg-neutral-900' : 'bg-white'} border {dark ? 'border-neutral-800' : 'border-gray-200'} rounded-lg p-6">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded {dark ? 'bg-neutral-800' : 'bg-gray-100'} flex items-center justify-center text-2xl">Pi</div>
        <div class="flex-1">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-xl font-medium {dark ? 'text-neutral-200' : 'text-gray-800'}">Pi</h2>
            <code class="text-xs {dark ? 'bg-neutral-800' : 'bg-gray-100'} {dark ? 'text-neutral-300' : 'text-gray-700'} px-2 py-1 rounded">pi</code>
          </div>
          <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} mb-3">Research and analysis specialist. Deep dives into docs, APIs, codebases.</p>
          <div class="flex gap-2 text-sm">
            <span class="{dark ? 'text-neutral-500' : 'text-gray-500'}">Default model:</span>
            <code class="{dark ? 'text-neutral-400' : 'text-gray-600'}">anthropic/claude-sonnet-4</code>
          </div>
        </div>
      </div>
    </div>

    <!-- Claude Code -->
    <div class="{dark ? 'bg-neutral-900' : 'bg-white'} border {dark ? 'border-neutral-800' : 'border-gray-200'} rounded-lg p-6">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded {dark ? 'bg-neutral-800' : 'bg-gray-100'} flex items-center justify-center text-2xl">Cc</div>
        <div class="flex-1">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-xl font-medium {dark ? 'text-neutral-200' : 'text-gray-800'}">Claude Code</h2>
            <code class="text-xs {dark ? 'bg-neutral-800' : 'bg-gray-100'} {dark ? 'text-neutral-300' : 'text-gray-700'} px-2 py-1 rounded">claude-code</code>
          </div>
          <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} mb-3">Anthropic's agentic coding tool. Complex multi-file changes.</p>
          <div class="flex gap-2 text-sm">
            <span class="{dark ? 'text-neutral-500' : 'text-gray-500'}">Default model:</span>
            <code class="{dark ? 'text-neutral-400' : 'text-gray-600'}">anthropic/claude-sonnet-4</code>
          </div>
        </div>
      </div>
    </div>

    <!-- Codex -->
    <div class="{dark ? 'bg-neutral-900' : 'bg-white'} border {dark ? 'border-neutral-800' : 'border-gray-200'} rounded-lg p-6">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded {dark ? 'bg-neutral-800' : 'bg-gray-100'} flex items-center justify-center text-2xl">Cx</div>
        <div class="flex-1">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-xl font-medium {dark ? 'text-neutral-200' : 'text-gray-800'}">Codex</h2>
            <code class="text-xs {dark ? 'bg-neutral-800' : 'bg-gray-100'} {dark ? 'text-neutral-300' : 'text-gray-700'} px-2 py-1 rounded">codex</code>
          </div>
          <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} mb-3">OpenAI's coding agent. Strong at Python, scripting, data.</p>
          <div class="flex gap-2 text-sm">
            <span class="{dark ? 'text-neutral-500' : 'text-gray-500'}">Default model:</span>
            <code class="{dark ? 'text-neutral-400' : 'text-gray-600'}">openai/o3</code>
          </div>
        </div>
      </div>
    </div>

    <!-- Cursor -->
    <div class="{dark ? 'bg-neutral-900' : 'bg-white'} border {dark ? 'border-neutral-800' : 'border-gray-200'} rounded-lg p-6">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded {dark ? 'bg-neutral-800' : 'bg-gray-100'} flex items-center justify-center text-2xl">Cu</div>
        <div class="flex-1">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-xl font-medium {dark ? 'text-neutral-200' : 'text-gray-800'}">Cursor</h2>
            <code class="text-xs {dark ? 'bg-neutral-800' : 'bg-gray-100'} {dark ? 'text-neutral-300' : 'text-gray-700'} px-2 py-1 rounded">cursor</code>
          </div>
          <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} mb-3">Cursor's agent mode via CLI. IDE-grade code intelligence.</p>
          <div class="flex gap-2 text-sm">
            <span class="{dark ? 'text-neutral-500' : 'text-gray-500'}">Default model:</span>
            <code class="{dark ? 'text-neutral-400' : 'text-gray-600'}">anthropic/claude-sonnet-4</code>
          </div>
        </div>
      </div>
    </div>

    <!-- Amp -->
    <div class="{dark ? 'bg-neutral-900' : 'bg-white'} border {dark ? 'border-neutral-800' : 'border-gray-200'} rounded-lg p-6">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded {dark ? 'bg-neutral-800' : 'bg-gray-100'} flex items-center justify-center text-2xl">Am</div>
        <div class="flex-1">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-xl font-medium {dark ? 'text-neutral-200' : 'text-gray-800'}">Amp</h2>
            <code class="text-xs {dark ? 'bg-neutral-800' : 'bg-gray-100'} {dark ? 'text-neutral-300' : 'text-gray-700'} px-2 py-1 rounded">amp</code>
          </div>
          <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} mb-3">Sourcegraph's agent. Large codebase navigation, cross-repo changes.</p>
          <div class="flex gap-2 text-sm">
            <span class="{dark ? 'text-neutral-500' : 'text-gray-500'}">Default model:</span>
            <code class="{dark ? 'text-neutral-400' : 'text-gray-600'}">anthropic/claude-sonnet-4</code>
          </div>
        </div>
      </div>
    </div>

    <!-- OpenCode -->
    <div class="{dark ? 'bg-neutral-900' : 'bg-white'} border {dark ? 'border-neutral-800' : 'border-gray-200'} rounded-lg p-6">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded {dark ? 'bg-neutral-800' : 'bg-gray-100'} flex items-center justify-center text-2xl">OC</div>
        <div class="flex-1">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-xl font-medium {dark ? 'text-neutral-200' : 'text-gray-800'}">OpenCode</h2>
            <code class="text-xs {dark ? 'bg-neutral-800' : 'bg-gray-100'} {dark ? 'text-neutral-300' : 'text-gray-700'} px-2 py-1 rounded">opencode</code>
          </div>
          <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} mb-3">Open-source coding agent. Terminal-based development.</p>
          <div class="flex gap-2 text-sm">
            <span class="{dark ? 'text-neutral-500' : 'text-gray-500'}">Default model:</span>
            <code class="{dark ? 'text-neutral-400' : 'text-gray-600'}">anthropic/claude-sonnet-4</code>
          </div>
        </div>
      </div>
    </div>

    <!-- Custom -->
    <div class="{dark ? 'bg-neutral-900' : 'bg-white'} border {dark ? 'border-neutral-800' : 'border-gray-200'} rounded-lg p-6 border-dashed">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded {dark ? 'bg-neutral-800' : 'bg-gray-100'} flex items-center justify-center text-2xl">BY</div>
        <div class="flex-1">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-xl font-medium {dark ? 'text-neutral-200' : 'text-gray-800'}">Custom</h2>
            <code class="text-xs {dark ? 'bg-neutral-800' : 'bg-gray-100'} {dark ? 'text-neutral-300' : 'text-gray-700'} px-2 py-1 rounded">custom</code>
          </div>
          <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} mb-3">Bring your own agent. Dockerfile that speaks the filepath protocol.</p>
          <a href="/docs/how-to/custom-agent" class="{dark ? 'text-neutral-300' : 'text-gray-700'} hover:underline text-sm">Learn how</a>
        </div>
      </div>
    </div>
  </div>

  <section class="mt-12 bg-neutral-900/50 border {dark ? 'border-neutral-800' : 'border-gray-200'} rounded-lg p-6">
    <h2 class="text-lg font-medium {dark ? 'text-neutral-200' : 'text-gray-800'} mb-4">How to Use</h2>
    <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} mb-4">When spawning an agent, use the <code>agentType</code> field:</p>
    <CodeBlock
      language="bash"
      className="bg-neutral-950 border {dark ? 'border-neutral-800' : 'border-gray-200'} rounded p-4 text-sm {dark ? 'text-neutral-300' : 'text-gray-700'} overflow-x-auto"
      code={`curl -X POST /api/sessions/{id}/nodes \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My Researcher",
    "agentType": "pi",
    "model": "anthropic/claude-sonnet-4"
  }'`}
    />
  </section>

  <footer class="border-t {dark ? 'border-neutral-800' : 'border-gray-200'} pt-6 mt-12 text-center">
    <p class="{dark ? 'text-neutral-500' : 'text-gray-500'} text-sm">
      Want to add your agent? <a href="https://github.com/acoyfellow/filepath/issues" class="{dark ? 'text-neutral-300' : 'text-gray-700'} hover:underline">Open an issue</a>
    </p>
  </footer>
</main>
</div>
