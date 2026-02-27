<script lang="ts">
  import Nav from '$lib/components/Nav.svelte';
  import CodeBlock from '$lib/components/CodeBlock.svelte';
</script>

<svelte:head>
  <title>Protocol Deep Dive | filepath</title>
  <meta name="description" content="The filepath Agent Protocol (FAP): NDJSON event types for agent communication over stdin/stdout." />
</svelte:head>

<Nav variant="centered" />

<main class="max-w-3xl mx-auto px-6 py-12">
  <div class="mb-8">
    <a href="/docs" class="text-neutral-500 hover:text-neutral-300 text-sm">Back to Docs</a>
  </div>

  <h1 class="text-3xl font-medium text-neutral-100 mb-4">Protocol</h1>
  <p class="text-neutral-400 mb-12">filepath Agent Protocol (FAP): how agents communicate.</p>

  <section class="mb-12">
    <h2 class="text-xl font-medium text-neutral-200 mb-4">Overview</h2>
    <p class="text-neutral-400 mb-4">FAP is NDJSON (newline-delimited JSON) over stdin/stdout. Simple, debuggable, language-agnostic.</p>
    <ul class="space-y-2 text-neutral-400 list-disc list-inside">
      <li>Agent reads from stdin</li>
      <li>Agent writes to stdout</li>
      <li>Each line is a JSON event</li>
      <li>No HTTP, no gRPC—just pipes</li>
    </ul>
  </section>

  <section class="mb-12">
    <h2 class="text-xl font-medium text-neutral-200 mb-4">Event Types</h2>
    
    <div class="space-y-6">
      <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
        <h3 class="text-neutral-300 font-medium mb-2">text</h3>
        <p class="text-neutral-500 text-sm mb-2">Agent sends text to the user</p>
        <CodeBlock language="json" className="bg-neutral-950 rounded p-3 text-sm text-neutral-300 overflow-x-auto" code={`{"type":"text","content":"Hello from the agent"}`} />
      </div>

      <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
        <h3 class="text-neutral-300 font-medium mb-2">tool</h3>
        <p class="text-neutral-500 text-sm mb-2">Agent wants to call a tool</p>
        <CodeBlock language="json" className="bg-neutral-950 rounded p-3 text-sm text-neutral-300 overflow-x-auto" code={`{"type":"tool","tool":"writeFile","args":{"path":"/workspace/readme.md","content":"# Hello"}}`} />
      </div>

      <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
        <h3 class="text-neutral-300 font-medium mb-2">command</h3>
        <p class="text-neutral-500 text-sm mb-2">Agent wants to run a shell command</p>
        <CodeBlock language="json" className="bg-neutral-950 rounded p-3 text-sm text-neutral-300 overflow-x-auto" code={`{"type":"command","command":"npm install","timeout":60000}`} />
      </div>

      <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
        <h3 class="text-neutral-300 font-medium mb-2">spawn</h3>
        <p class="text-neutral-500 text-sm mb-2">Agent wants to spawn a child agent</p>
        <CodeBlock language="json" className="bg-neutral-950 rounded p-3 text-sm text-neutral-300 overflow-x-auto" code={`{"type":"spawn","name":"Worker","agentType":"pi","task":"Research this topic"}`} />
      </div>

      <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
        <h3 class="text-neutral-300 font-medium mb-2">commit</h3>
        <p class="text-neutral-500 text-sm mb-2">Agent made changes, wants to commit</p>
        <CodeBlock language="json" className="bg-neutral-950 rounded p-3 text-sm text-neutral-300 overflow-x-auto" code={`{"type":"commit","message":"Add feature X","files":["src/feature.ts"]}`} />
      </div>

      <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
        <h3 class="text-neutral-300 font-medium mb-2">done</h3>
        <p class="text-neutral-500 text-sm mb-2">Agent finished its task</p>
        <CodeBlock language="json" className="bg-neutral-950 rounded p-3 text-sm text-neutral-300 overflow-x-auto" code={`{"type":"done"}`} />
      </div>

      <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
        <h3 class="text-neutral-300 font-medium mb-2">status</h3>
        <p class="text-neutral-500 text-sm mb-2">Agent status update</p>
        <CodeBlock language="json" className="bg-neutral-950 rounded p-3 text-sm text-neutral-300 overflow-x-auto" code={`{"type":"status","state":"running"}`} />
      </div>
    </div>
  </section>

  <section class="mb-12">
    <h2 class="text-xl font-medium text-neutral-200 mb-4">Input Events (to agent)</h2>
    <p class="text-neutral-400 mb-4">What the agent receives from filepath:</p>
    
    <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <h3 class="text-neutral-300 font-medium mb-2">message</h3>
      <p class="text-neutral-500 text-sm mb-2">User sent a message</p>
      <CodeBlock language="json" className="bg-neutral-950 rounded p-3 text-sm text-neutral-300 overflow-x-auto" code={`{"type":"message","content":"Write a function to...","id":"msg-123"}`} />
    </div>
  </section>

  <section class="mb-12">
    <h2 class="text-xl font-medium text-neutral-200 mb-4">Environment Variables</h2>
    <p class="text-neutral-400 mb-4">filepath sets these env vars for the agent:</p>
    <ul class="space-y-2 text-neutral-400 list-disc list-inside">
      <li><code>FILEPATH_TASK</code> — Initial task description</li>
      <li><code>FILEPATH_API_KEY</code> — API key for LLM calls</li>
      <li><code>FILEPATH_MODEL</code> — Model to use (e.g., claude-sonnet-4)</li>
      <li><code>FILEPATH_AGENT_ID</code> — Unique agent node ID</li>
      <li><code>FILEPATH_SESSION_ID</code> — Session ID</li>
      <li><code>FILEPATH_PARENT_ID</code> — Parent agent ID (if any)</li>
    </ul>
  </section>

  <section class="mb-12">
    <h2 class="text-xl font-medium text-neutral-200 mb-4">WebSocket Protocol</h2>
    <p class="text-neutral-400 mb-4">For browser-to-agent communication, filepath uses Cloudflare's AIChatAgent protocol:</p>
    <ul class="space-y-2 text-neutral-400 list-disc list-inside">
      <li><code>cf_agent_chat_messages</code> — Full message list sync</li>
      <li><code>cf_agent_use_chat_request</code> — Send a message</li>
      <li><code>cf_agent_use_chat_response</code> — Streaming response chunks</li>
      <li><code>cf_agent_stream_resuming</code> — Resume interrupted streams</li>
      <li><code>cf_agent_chat_request_cancel</code> — Cancel current request</li>
    </ul>
    <p class="text-neutral-500 text-sm mt-4">Connect to: <code>wss://api.myfilepath.com/agents/chat-agent/{'{nodeId}'}</code></p>
  </section>

  <footer class="border-t border-neutral-800 pt-6 text-center">
    <p class="text-neutral-500 text-sm">
        <a href="/docs/reference/api" class="text-neutral-300 hover:underline">Next: API Reference</a>
    </p>
  </footer>
</main>
