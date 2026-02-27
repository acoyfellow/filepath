<script lang="ts">
  import CodeBlock from '$lib/components/CodeBlock.svelte';</script>

<svelte:head>
  <title>Agent Catalog | filepath</title>
  <meta name="description" content="Available agents on filepath: Shelley, Pi, Claude Code, Codex, Cursor, Amp, OpenCode, and custom agents." />
</svelte:head>

<div class="min-h-screen font-sans bg-gray-50 text-gray-700 dark:bg-neutral-950 dark:text-neutral-300 transition-colors duration-200">
<main class="max-w-3xl mx-auto px-6 py-12">
  <div class="mb-8">
    <a href="/docs" class="text-gray-500 dark:text-neutral-500 hover:text-neutral-300 text-sm">Back to Docs</a>
  </div>

  <h1 class="text-3xl font-medium text-gray-900 dark:text-neutral-100 mb-4">Agent Catalog</h1>
  <p class="text-gray-600 dark:text-neutral-400 mb-12">Available agents you can spawn.</p>

  <div class="space-y-6">
    <!-- Shelley -->
    <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-6">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-2xl">Sh</div>
        <div class="flex-1">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200">Shelley</h2>
            <code class="text-xs bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 px-2 py-1 rounded">shelley</code>
          </div>
          <p class="text-gray-600 dark:text-neutral-400 mb-3">Full-stack engineering agent. filepath-native reference implementation.</p>
          <div class="flex gap-2 text-sm">
            <span class="text-gray-500 dark:text-neutral-500">Default model:</span>
            <code class="text-gray-600 dark:text-neutral-400">anthropic/claude-sonnet-4</code>
          </div>
        </div>
      </div>
    </div>

    <!-- Pi -->
    <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-6">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-2xl">Pi</div>
        <div class="flex-1">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200">Pi</h2>
            <code class="text-xs bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 px-2 py-1 rounded">pi</code>
          </div>
          <p class="text-gray-600 dark:text-neutral-400 mb-3">Research and analysis specialist. Deep dives into docs, APIs, codebases.</p>
          <div class="flex gap-2 text-sm">
            <span class="text-gray-500 dark:text-neutral-500">Default model:</span>
            <code class="text-gray-600 dark:text-neutral-400">anthropic/claude-sonnet-4</code>
          </div>
        </div>
      </div>
    </div>

    <!-- Claude Code -->
    <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-6">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-2xl">Cc</div>
        <div class="flex-1">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200">Claude Code</h2>
            <code class="text-xs bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 px-2 py-1 rounded">claude-code</code>
          </div>
          <p class="text-gray-600 dark:text-neutral-400 mb-3">Anthropic's agentic coding tool. Complex multi-file changes.</p>
          <div class="flex gap-2 text-sm">
            <span class="text-gray-500 dark:text-neutral-500">Default model:</span>
            <code class="text-gray-600 dark:text-neutral-400">anthropic/claude-sonnet-4</code>
          </div>
        </div>
      </div>
    </div>

    <!-- Codex -->
    <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-6">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-2xl">Cx</div>
        <div class="flex-1">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200">Codex</h2>
            <code class="text-xs bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 px-2 py-1 rounded">codex</code>
          </div>
          <p class="text-gray-600 dark:text-neutral-400 mb-3">OpenAI's coding agent. Strong at Python, scripting, data.</p>
          <div class="flex gap-2 text-sm">
            <span class="text-gray-500 dark:text-neutral-500">Default model:</span>
            <code class="text-gray-600 dark:text-neutral-400">openai/o3</code>
          </div>
        </div>
      </div>
    </div>

    <!-- Cursor -->
    <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-6">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-2xl">Cu</div>
        <div class="flex-1">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200">Cursor</h2>
            <code class="text-xs bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 px-2 py-1 rounded">cursor</code>
          </div>
          <p class="text-gray-600 dark:text-neutral-400 mb-3">Cursor's agent mode via CLI. IDE-grade code intelligence.</p>
          <div class="flex gap-2 text-sm">
            <span class="text-gray-500 dark:text-neutral-500">Default model:</span>
            <code class="text-gray-600 dark:text-neutral-400">anthropic/claude-sonnet-4</code>
          </div>
        </div>
      </div>
    </div>

    <!-- Amp -->
    <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-6">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-2xl">Am</div>
        <div class="flex-1">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200">Amp</h2>
            <code class="text-xs bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 px-2 py-1 rounded">amp</code>
          </div>
          <p class="text-gray-600 dark:text-neutral-400 mb-3">Sourcegraph's agent. Large codebase navigation, cross-repo changes.</p>
          <div class="flex gap-2 text-sm">
            <span class="text-gray-500 dark:text-neutral-500">Default model:</span>
            <code class="text-gray-600 dark:text-neutral-400">anthropic/claude-sonnet-4</code>
          </div>
        </div>
      </div>
    </div>

    <!-- OpenCode -->
    <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-6">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-2xl">OC</div>
        <div class="flex-1">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200">OpenCode</h2>
            <code class="text-xs bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 px-2 py-1 rounded">opencode</code>
          </div>
          <p class="text-gray-600 dark:text-neutral-400 mb-3">Open-source coding agent. Terminal-based development.</p>
          <div class="flex gap-2 text-sm">
            <span class="text-gray-500 dark:text-neutral-500">Default model:</span>
            <code class="text-gray-600 dark:text-neutral-400">anthropic/claude-sonnet-4</code>
          </div>
        </div>
      </div>
    </div>

    <!-- Custom -->
    <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-6 border-dashed">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-2xl">BY</div>
        <div class="flex-1">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200">Custom</h2>
            <code class="text-xs bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 px-2 py-1 rounded">custom</code>
          </div>
          <p class="text-gray-600 dark:text-neutral-400 mb-3">Bring your own agent. Dockerfile that speaks the filepath protocol.</p>
          <a href="/docs/how-to/custom-agent" class="text-gray-700 dark:text-neutral-300 hover:underline text-sm">Learn how</a>
        </div>
      </div>
    </div>
  </div>

  <section class="mt-12 bg-gray-100 dark:bg-neutral-900/50 border border-gray-200 dark:border-neutral-800 rounded-lg p-6">
    <h2 class="text-lg font-medium text-gray-800 dark:text-neutral-200 mb-4">How to Use</h2>
    <p class="text-gray-600 dark:text-neutral-400 mb-4">When spawning an agent, use the <code>agentType</code> field:</p>
    <CodeBlock
      language="bash"
      className="bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded p-4 text-sm text-gray-700 dark:text-neutral-300 overflow-x-auto"
      code={`curl -X POST /api/sessions/{id}/nodes \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My Researcher",
    "agentType": "pi",
    "model": "anthropic/claude-sonnet-4"
  }'`}
    />
  </section>

  <footer class="border-t border-gray-200 dark:border-neutral-800 pt-6 mt-12 text-center">
    <p class="text-gray-500 dark:text-neutral-500 text-sm">
      Want to add your agent? <a href="https://github.com/acoyfellow/filepath/issues" class="text-gray-700 dark:text-neutral-300 hover:underline">Open an issue</a>
    </p>
  </footer>
</main>
</div>
