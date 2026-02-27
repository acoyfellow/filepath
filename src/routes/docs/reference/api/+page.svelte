<script lang="ts">
</script>

<svelte:head>
  <title>API Reference | filepath</title>
  <meta name="description" content="filepath API reference: REST endpoints, WebSocket protocol, and agent catalog." />
</svelte:head>

<div class="min-h-screen font-sans bg-gray-50 text-gray-700 dark:bg-neutral-950 dark:text-neutral-300 transition-colors duration-200">
<main class="max-w-3xl mx-auto px-6 py-12">
  <div class="mb-8">
    <a href="/docs" class="text-gray-500 dark:text-neutral-500 hover:text-neutral-300 text-sm">Back to Docs</a>
  </div>

  <h1 class="text-3xl font-medium text-gray-900 dark:text-neutral-100 mb-4">API Reference</h1>
  <p class="text-gray-600 dark:text-neutral-400 mb-12">Complete API documentation for filepath.</p>

  <section class="mb-12">
    <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200 mb-6">Interactive Documentation</h2>
    <div class="grid gap-4 md:grid-cols-2">
      <a href="/api/openapi.json" class="block bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-6 hover:border-neutral-700 transition-colors">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-medium text-gray-800 dark:text-neutral-200">OpenAPI Spec</h3>
          <span class="text-xs bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 px-2 py-1 rounded">JSON</span>
        </div>
        <p class="text-gray-600 dark:text-neutral-400 text-sm">Complete API specification</p>
      </a>

      <a href="/api/auth/reference" class="block bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-6 hover:border-neutral-700 transition-colors">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-medium text-gray-800 dark:text-neutral-200">Interactive Docs</h3>
          <span class="text-xs bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 px-2 py-1 rounded">Scalar</span>
        </div>
        <p class="text-gray-600 dark:text-neutral-400 text-sm">Test endpoints in browser</p>
      </a>

      <a href="/agent-api" class="block bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-6 hover:border-neutral-700 transition-colors">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-medium text-gray-800 dark:text-neutral-200">Agent API Guide</h3>
          <span class="text-xs bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 px-2 py-1 rounded">Guide</span>
        </div>
        <p class="text-gray-600 dark:text-neutral-400 text-sm">Programmatic access for AI agents</p>
      </a>

      <a href="/llms.txt" class="block bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-6 hover:border-neutral-700 transition-colors">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-medium text-gray-800 dark:text-neutral-200">llms.txt</h3>
          <span class="text-xs bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 px-2 py-1 rounded">Context</span>
        </div>
        <p class="text-gray-600 dark:text-neutral-400 text-sm">For AI assistants</p>
      </a>
    </div>
  </section>

  <section class="mb-12">
    <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200 mb-4">Core Endpoints</h2>
    
    <div class="space-y-4">
      <div class="border-l-2 border-green-900 pl-4 py-2">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded">POST</span>
          <code class="text-gray-700 dark:text-neutral-300 text-sm">/api/auth/sign-up/email</code>
        </div>
        <p class="text-gray-500 dark:text-neutral-500 text-sm">Create new account</p>
      </div>

      <div class="border-l-2 border-green-900 pl-4 py-2">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded">POST</span>
          <code class="text-gray-700 dark:text-neutral-300 text-sm">/api/auth/sign-in/email</code>
        </div>
        <p class="text-gray-500 dark:text-neutral-500 text-sm">Sign in to existing account</p>
      </div>

      <div class="border-l-2 border-blue-900 pl-4 py-2">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded">GET</span>
          <code class="text-gray-700 dark:text-neutral-300 text-sm">/api/sessions</code>
        </div>
        <p class="text-gray-500 dark:text-neutral-500 text-sm">List all sessions</p>
      </div>

      <div class="border-l-2 border-green-900 pl-4 py-2">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded">POST</span>
          <code class="text-gray-700 dark:text-neutral-300 text-sm">/api/sessions</code>
        </div>
        <p class="text-gray-500 dark:text-neutral-500 text-sm">Create new session</p>
      </div>

      <div class="border-l-2 border-blue-900 pl-4 py-2">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded">GET</span>
          <code class="text-gray-700 dark:text-neutral-300 text-sm">/api/sessions/{'{id}'}</code>
        </div>
        <p class="text-gray-500 dark:text-neutral-500 text-sm">Get session details</p>
      </div>

      <div class="border-l-2 border-blue-900 pl-4 py-2">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded">GET</span>
          <code class="text-gray-700 dark:text-neutral-300 text-sm">/api/sessions/{'{id}'}/nodes</code>
        </div>
        <p class="text-gray-500 dark:text-neutral-500 text-sm">List all nodes in session</p>
      </div>

      <div class="border-l-2 border-green-900 pl-4 py-2">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded">POST</span>
          <code class="text-gray-700 dark:text-neutral-300 text-sm">/api/sessions/{'{id}'}/nodes</code>
        </div>
        <p class="text-gray-500 dark:text-neutral-500 text-sm">Spawn new agent node</p>
      </div>

      <div class="border-l-2 border-blue-900 pl-4 py-2">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded">GET</span>
          <code class="text-gray-700 dark:text-neutral-300 text-sm">/api/sessions/{'{id}'}/tree</code>
        </div>
        <p class="text-gray-500 dark:text-neutral-500 text-sm">Get hierarchical tree structure</p>
      </div>

      <div class="border-l-2 border-blue-900 pl-4 py-2">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded">GET</span>
          <code class="text-gray-700 dark:text-neutral-300 text-sm">/api/user/keys</code>
        </div>
        <p class="text-gray-500 dark:text-neutral-500 text-sm">Get masked API keys</p>
      </div>

      <div class="border-l-2 border-green-900 pl-4 py-2">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded">POST</span>
          <code class="text-gray-700 dark:text-neutral-300 text-sm">/api/user/keys</code>
        </div>
        <p class="text-gray-500 dark:text-neutral-500 text-sm">Store encrypted API key</p>
      </div>

      <div class="border-l-2 border-blue-900 pl-4 py-2">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded">GET</span>
          <code class="text-gray-700 dark:text-neutral-300 text-sm">/api/models</code>
        </div>
        <p class="text-gray-500 dark:text-neutral-500 text-sm">List available LLM models</p>
      </div>

      <div class="border-l-2 border-blue-900 pl-4 py-2">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded">GET</span>
          <code class="text-gray-700 dark:text-neutral-300 text-sm">/api/config</code>
        </div>
        <p class="text-gray-500 dark:text-neutral-500 text-sm">Get environment config (WebSocket URL)</p>
      </div>
    </div>
  </section>

  <section class="mb-12">
    <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200 mb-4">WebSocket Endpoint</h2>
    <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-4">
      <code class="text-gray-700 dark:text-neutral-300 text-sm">wss://api.myfilepath.com/agents/chat-agent/{'{nodeId}'}</code>
      <p class="text-gray-500 dark:text-neutral-500 text-sm mt-2">Real-time chat with agent. Uses Cloudflare AIChatAgent protocol.</p>
    </div>
  </section>

  <section class="mb-12">
    <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200 mb-4">Authentication</h2>
    <ul class="space-y-2 text-gray-600 dark:text-neutral-400 list-disc list-inside">
      <li><strong>Session Cookie</strong> — Standard browser auth (Better Auth)</li>
      <li><strong>API Key</strong> — <code>x-api-key</code> header for programmatic access</li>
      <li><strong>Bearer Token</strong> — JWT in <code>Authorization: Bearer ...</code> header</li>
    </ul>
  </section>

  <footer class="border-t border-gray-200 dark:border-neutral-800 pt-6 text-center">
    <p class="text-gray-500 dark:text-neutral-500 text-sm">
        <a href="/docs/agents" class="text-gray-700 dark:text-neutral-300 hover:underline">Next: Agent Catalog</a>
    </p>
  </footer>
</main>
</div>
