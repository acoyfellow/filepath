<script lang="ts">
  import CodeBlock from '$lib/components/CodeBlock.svelte';</script>

<svelte:head>
  <title>Protocol Deep Dive | filepath</title>
  <meta name="description" content="The filepath Agent Protocol (FAP): NDJSON event types for agent communication over stdin/stdout." />
</svelte:head>

<div class="min-h-screen font-sans bg-gray-50 text-gray-700 dark:bg-neutral-950 dark:text-neutral-300 transition-colors duration-200">
<main class="max-w-3xl mx-auto px-6 py-12">
  <div class="mb-8">
    <a href="/docs" class="text-gray-500 dark:text-neutral-500 hover:text-neutral-300 text-sm">Back to Docs</a>
  </div>

  <h1 class="text-3xl font-medium text-gray-900 dark:text-neutral-100 mb-4">Protocol</h1>
  <p class="text-gray-600 dark:text-neutral-400 mb-12">filepath Agent Protocol (FAP): how agents communicate.</p>

  <section class="mb-12">
    <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200 mb-4">Overview</h2>
    <p class="text-gray-600 dark:text-neutral-400 mb-4">FAP is NDJSON (newline-delimited JSON) over stdin/stdout. Simple, debuggable, language-agnostic.</p>
    <ul class="space-y-2 text-gray-600 dark:text-neutral-400 list-disc list-inside">
      <li>Agent reads from stdin</li>
      <li>Agent writes to stdout</li>
      <li>Each line is a JSON event</li>
      <li>No HTTP, no gRPC—just pipes</li>
    </ul>
  </section>

  <section class="mb-12">
    <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200 mb-4">Event Types</h2>
    
    <div class="space-y-6">
      <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-4">
        <h3 class="text-gray-700 dark:text-neutral-300 font-medium mb-2">text</h3>
        <p class="text-gray-500 dark:text-neutral-500 text-sm mb-2">Agent sends text to the user</p>
        <CodeBlock language="json" className="bg-neutral-950 rounded p-3 text-sm text-gray-700 dark:text-neutral-300 overflow-x-auto" code={`{"type":"text","content":"Hello from the agent"}`} />
      </div>

      <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-4">
        <h3 class="text-gray-700 dark:text-neutral-300 font-medium mb-2">tool</h3>
        <p class="text-gray-500 dark:text-neutral-500 text-sm mb-2">Agent wants to call a tool</p>
        <CodeBlock language="json" className="bg-neutral-950 rounded p-3 text-sm text-gray-700 dark:text-neutral-300 overflow-x-auto" code={`{"type":"tool","tool":"writeFile","args":{"path":"/workspace/readme.md","content":"# Hello"}}`} />
      </div>

      <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-4">
        <h3 class="text-gray-700 dark:text-neutral-300 font-medium mb-2">command</h3>
        <p class="text-gray-500 dark:text-neutral-500 text-sm mb-2">Agent wants to run a shell command</p>
        <CodeBlock language="json" className="bg-neutral-950 rounded p-3 text-sm text-gray-700 dark:text-neutral-300 overflow-x-auto" code={`{"type":"command","command":"npm install","timeout":60000}`} />
      </div>

      <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-4">
        <h3 class="text-gray-700 dark:text-neutral-300 font-medium mb-2">spawn</h3>
        <p class="text-gray-500 dark:text-neutral-500 text-sm mb-2">Agent wants to spawn a child agent</p>
        <CodeBlock language="json" className="bg-neutral-950 rounded p-3 text-sm text-gray-700 dark:text-neutral-300 overflow-x-auto" code={`{"type":"spawn","name":"Worker","agentType":"pi","task":"Research this topic"}`} />
      </div>

      <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-4">
        <h3 class="text-gray-700 dark:text-neutral-300 font-medium mb-2">commit</h3>
        <p class="text-gray-500 dark:text-neutral-500 text-sm mb-2">Agent made changes, wants to commit</p>
        <CodeBlock language="json" className="bg-neutral-950 rounded p-3 text-sm text-gray-700 dark:text-neutral-300 overflow-x-auto" code={`{"type":"commit","message":"Add feature X","files":["src/feature.ts"]}`} />
      </div>

      <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-4">
        <h3 class="text-gray-700 dark:text-neutral-300 font-medium mb-2">done</h3>
        <p class="text-gray-500 dark:text-neutral-500 text-sm mb-2">Agent finished its task</p>
        <CodeBlock language="json" className="bg-neutral-950 rounded p-3 text-sm text-gray-700 dark:text-neutral-300 overflow-x-auto" code={`{"type":"done"}`} />
      </div>

      <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-4">
        <h3 class="text-gray-700 dark:text-neutral-300 font-medium mb-2">status</h3>
        <p class="text-gray-500 dark:text-neutral-500 text-sm mb-2">Agent status update</p>
        <CodeBlock language="json" className="bg-neutral-950 rounded p-3 text-sm text-gray-700 dark:text-neutral-300 overflow-x-auto" code={`{"type":"status","state":"running"}`} />
      </div>

      <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-4">
        <h3 class="text-gray-700 dark:text-neutral-300 font-medium mb-2">handoff</h3>
        <p class="text-gray-500 dark:text-neutral-500 text-sm mb-2">Agent hit the end of its useful context and becomes exhausted</p>
        <CodeBlock language="json" className="bg-neutral-950 rounded p-3 text-sm text-gray-700 dark:text-neutral-300 overflow-x-auto" code={`{"type":"handoff","summary":"Context exhausted after finishing code review pass"}`} />
      </div>
    </div>
  </section>

  <section class="mb-12">
    <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200 mb-4">Input Events (to agent)</h2>
    <p class="text-gray-600 dark:text-neutral-400 mb-4">What the agent receives from filepath:</p>
    
    <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-4">
      <h3 class="text-gray-700 dark:text-neutral-300 font-medium mb-2">message</h3>
      <p class="text-gray-500 dark:text-neutral-500 text-sm mb-2">User sent a message</p>
      <CodeBlock language="json" className="bg-neutral-950 rounded p-3 text-sm text-gray-700 dark:text-neutral-300 overflow-x-auto" code={`{"type":"message","content":"Write a function to...","id":"msg-123"}`} />
    </div>
  </section>

  <section class="mb-12">
    <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200 mb-4">Environment Variables</h2>
    <p class="text-gray-600 dark:text-neutral-400 mb-4">filepath sets these env vars for the agent:</p>
    <ul class="space-y-2 text-gray-600 dark:text-neutral-400 list-disc list-inside">
      <li><code>FILEPATH_TASK</code> — Initial task description</li>
      <li><code>FILEPATH_API_KEY</code> — API key for LLM calls</li>
      <li><code>FILEPATH_MODEL</code> — Model to use (e.g., anthropic/claude-sonnet-4.5)</li>
      <li><code>FILEPATH_AGENT_ID</code> — Unique agent node ID</li>
      <li><code>FILEPATH_SESSION_ID</code> — Session ID</li>
      <li><code>FILEPATH_PARENT_ID</code> — Parent agent ID (if any)</li>
    </ul>
  </section>

  <section class="mb-12">
    <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200 mb-4">WebSocket Protocol</h2>
    <p class="text-gray-600 dark:text-neutral-400 mb-4">For browser-to-agent communication, filepath uses a thin native WebSocket protocol around the ChatAgent durable object:</p>
    <ul class="space-y-2 text-gray-600 dark:text-neutral-400 list-disc list-inside">
      <li><code>{`{"type":"message","content":"..."}`}</code> — send a user message</li>
      <li><code>{`{"type":"history", ...}`}</code> — full durable message history on connect</li>
      <li><code>{`{"type":"event","event":{...}}`}</code> — protocol events from the runtime</li>
      <li><code>{`{"type":"error","message":"..."}`}</code> — explicit runtime or lifecycle failure</li>
    </ul>
    <p class="text-gray-500 dark:text-neutral-500 text-sm mt-4">Connect to: <code>wss://api.myfilepath.com/agents/chat-agent/{'{nodeId}'}</code></p>
  </section>

  <footer class="border-t border-gray-200 dark:border-neutral-800 pt-6 text-center">
    <p class="text-gray-500 dark:text-neutral-500 text-sm">
        <a href="/docs/reference/api" class="text-gray-700 dark:text-neutral-300 hover:underline">Next: API Reference</a>
    </p>
  </footer>
</main>
</div>
