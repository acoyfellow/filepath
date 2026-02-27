<script lang="ts">
  import Nav from '$lib/components/Nav.svelte';
  import CodeBlock from '$lib/components/CodeBlock.svelte';
</script>

<svelte:head>
  <title>Agent API | filepath - Programmatic Access for AI Agents</title>
  <meta name="description" content="Complete API documentation for AI agents to use filepath programmatically. Sign up, authenticate, create sessions, spawn agents, and chat via API." />
</svelte:head>

<Nav />

<main class="max-w-4xl mx-auto px-6 py-12">
  <div class="mb-8">
    <a href="/" class="text-neutral-500 hover:text-neutral-300 text-sm">Back to Home</a>
  </div>

  <div class="mb-12">
    <h1 class="text-4xl font-medium text-neutral-100 mb-4">Agent API</h1>
    <p class="text-xl text-neutral-400">
      Programmatic access for AI agents. Create sessions, spawn agents, and orchestrate workflows via API.
    </p>
  </div>

  <!-- Quick Start -->
  <section class="mb-16">
    <h2 class="text-2xl font-medium text-neutral-200 mb-6">Quick Start (5 Minutes)</h2>
    
    <div class="space-y-6">
      <!-- Step 1 -->
      <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <span class="w-8 h-8 rounded-full bg-neutral-800 text-neutral-300 flex items-center justify-center text-sm font-medium">1</span>
          <h3 class="text-lg font-medium text-neutral-200">Sign Up</h3>
        </div>
        <p class="text-neutral-400 mb-4">Create an account programmatically:</p>
        <CodeBlock
          language="bash"
          className="bg-neutral-950 border border-neutral-800 rounded p-4 text-sm text-neutral-300 overflow-x-auto"
          code={`curl -X POST https://myfilepath.com/api/auth/sign-up/email \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "your-agent@example.com",
    "password": "secure-password-123",
    "name": "My AI Agent"
  }'`}
        />
      </div>

      <!-- Step 2 -->
      <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <span class="w-8 h-8 rounded-full bg-neutral-800 text-neutral-300 flex items-center justify-center text-sm font-medium">2</span>
          <h3 class="text-lg font-medium text-neutral-200">Add Your API Key</h3>
        </div>
        <p class="text-neutral-400 mb-4">Store your OpenRouter API key (BYOK model):</p>
        <CodeBlock
          language="bash"
          className="bg-neutral-950 border border-neutral-800 rounded p-4 text-sm text-neutral-300 overflow-x-auto"
          code={`curl -X POST https://myfilepath.com/api/user/keys \\
  -H "Content-Type: application/json" \\
  -H "Cookie: session=your-session-cookie" \\
  -d '{"provider": "openrouter", "key": "sk-or-v1-..."}'`}
        />
        <p class="text-neutral-500 text-sm mt-2">Get an OpenRouter key at <a href="https://openrouter.ai/keys" class="text-neutral-300 hover:underline">openrouter.ai/keys</a></p>
      </div>

      <!-- Step 3 -->
      <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <span class="w-8 h-8 rounded-full bg-neutral-800 text-neutral-300 flex items-center justify-center text-sm font-medium">3</span>
          <h3 class="text-lg font-medium text-neutral-200">Create a Session</h3>
        </div>
        <CodeBlock
          language="bash"
          className="bg-neutral-950 border border-neutral-800 rounded p-4 text-sm text-neutral-300 overflow-x-auto"
          code={`curl -X POST https://myfilepath.com/api/sessions \\
  -H "Content-Type: application/json" \\
  -H "Cookie: session=your-session-cookie" \\
  -d '{"name": "My Research Task"}'`}
        />
      </div>

      <!-- Step 4 -->
      <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <span class="w-8 h-8 rounded-full bg-neutral-800 text-neutral-300 flex items-center justify-center text-sm font-medium">4</span>
          <h3 class="text-lg font-medium text-neutral-200">Spawn an Agent</h3>
        </div>
        <CodeBlock
          language="bash"
          className="bg-neutral-950 border border-neutral-800 rounded p-4 text-sm text-neutral-300 overflow-x-auto"
          code={`curl -X POST https://myfilepath.com/api/sessions/{sessionId}/nodes \\
  -H "Content-Type: application/json" \\
  -H "Cookie: session=your-session-cookie" \\
  -d '{
    "name": "Pi Researcher",
    "agentType": "pi",
    "model": "anthropic/claude-sonnet-4"
  }'`}
        />
      </div>

      <!-- Step 5 -->
      <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <span class="w-8 h-8 rounded-full bg-neutral-800 text-neutral-300 flex items-center justify-center text-sm font-medium">5</span>
          <h3 class="text-lg font-medium text-neutral-200">Chat via WebSocket</h3>
        </div>
        <CodeBlock
          language="bash"
          className="bg-neutral-950 border border-neutral-800 rounded p-4 text-sm text-neutral-300 overflow-x-auto"
          code={`# Connect to WebSocket
wscat -c "wss://api.myfilepath.com/agents/chat-agent/{nodeId}"

# Send a message
> {"type": "message", "content": "Research quantum computing and summarize"}`}
        />
      </div>
    </div>
  </section>

  <!-- API Reference -->
  <section class="mb-16">
    <h2 class="text-2xl font-medium text-neutral-200 mb-6">API Reference</h2>
    
    <div class="grid md:grid-cols-2 gap-4">
      <a href="/api/openapi.json" class="block bg-neutral-900 border border-neutral-800 rounded-lg p-6 hover:border-neutral-700 transition-colors">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-lg font-medium text-neutral-200">OpenAPI Spec</h3>
          <span class="text-xs bg-neutral-800 text-neutral-400 px-2 py-1 rounded">JSON</span>
        </div>
        <p class="text-neutral-400 text-sm">Complete API specification in OpenAPI 3.0 format</p>
      </a>

      <a href="/api/auth/reference" class="block bg-neutral-900 border border-neutral-800 rounded-lg p-6 hover:border-neutral-700 transition-colors">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-lg font-medium text-neutral-200">Interactive Docs</h3>
          <span class="text-xs bg-neutral-800 text-neutral-400 px-2 py-1 rounded">Scalar UI</span>
        </div>
        <p class="text-neutral-400 text-sm">Test endpoints directly in the browser</p>
      </a>

      <a href="/docs/explanation/protocol" class="block bg-neutral-900 border border-neutral-800 rounded-lg p-6 hover:border-neutral-700 transition-colors">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-lg font-medium text-neutral-200">Protocol Deep Dive</h3>
          <span class="text-xs bg-neutral-800 text-neutral-400 px-2 py-1 rounded">Docs</span>
        </div>
        <p class="text-neutral-400 text-sm">Learn the filepath Agent Protocol (FAP)</p>
      </a>

      <a href="/llms.txt" class="block bg-neutral-900 border border-neutral-800 rounded-lg p-6 hover:border-neutral-700 transition-colors">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-lg font-medium text-neutral-200">LLMs Context</h3>
          <span class="text-xs bg-neutral-800 text-neutral-400 px-2 py-1 rounded">llms.txt</span>
        </div>
        <p class="text-neutral-400 text-sm">Context file for AI assistants</p>
      </a>
    </div>
  </section>

  <!-- Available Agents -->
  <section class="mb-16">
    <h2 class="text-2xl font-medium text-neutral-200 mb-6">Available Agents</h2>
    
    <div class="space-y-4">
      <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex items-center gap-4">
          <div class="w-10 h-10 rounded bg-neutral-800 flex items-center justify-center text-lg">Pi</div>
        <div class="flex-1">
          <h3 class="font-medium text-neutral-200">Pi</h3>
          <p class="text-neutral-400 text-sm">Research and analysis specialist. Deep dives into docs, APIs, codebases.</p>
        </div>
        <code class="text-xs bg-neutral-800 text-neutral-300 px-2 py-1 rounded">agentType: "pi"</code>
      </div>

      <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex items-center gap-4">
          <div class="w-10 h-10 rounded bg-neutral-800 flex items-center justify-center text-lg">Sh</div>
        <div class="flex-1">
          <h3 class="font-medium text-neutral-200">Shelley</h3>
          <p class="text-neutral-400 text-sm">Full-stack engineering. filepath-native reference implementation.</p>
        </div>
        <code class="text-xs bg-neutral-800 text-neutral-300 px-2 py-1 rounded">agentType: "shelley"</code>
      </div>

      <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex items-center gap-4">
          <div class="w-10 h-10 rounded bg-neutral-800 flex items-center justify-center text-lg">Cc</div>
        <div class="flex-1">
          <h3 class="font-medium text-neutral-200">Claude Code</h3>
          <p class="text-neutral-400 text-sm">Anthropic's agentic coding tool. Complex multi-file changes.</p>
        </div>
        <code class="text-xs bg-neutral-800 text-neutral-300 px-2 py-1 rounded">agentType: "claude-code"</code>
      </div>

      <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex items-center gap-4">
          <div class="w-10 h-10 rounded bg-neutral-800 flex items-center justify-center text-lg">Cx</div>
        <div class="flex-1">
          <h3 class="font-medium text-neutral-200">Codex</h3>
          <p class="text-neutral-400 text-sm">OpenAI's coding agent. Strong at Python, scripting, data.</p>
        </div>
        <code class="text-xs bg-neutral-800 text-neutral-300 px-2 py-1 rounded">agentType: "codex"</code>
      </div>
    </div>

    <p class="text-neutral-500 text-sm mt-4">
      Also available: cursor, amp, opencode, custom. 
      <a href="/docs/agents" class="text-neutral-300 hover:underline">View full catalog</a>
    </p>
  </section>

  <!-- BYOK Model -->
  <section class="mb-16">
    <h2 class="text-2xl font-medium text-neutral-200 mb-6">Bring Your Own Key (BYOK)</h2>
    
    <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
      <p class="text-neutral-400 mb-4">
        filepath operates on a BYOK model. You bring your own LLM API keys—we don't charge for usage.
      </p>
      
      <h3 class="text-lg font-medium text-neutral-200 mb-3">Supported Providers</h3>
      <ul class="space-y-2 text-neutral-400 mb-6">
        <li>• <strong>OpenRouter</strong> — Recommended. Access 100+ models via one key.</li>
        <li>• <strong>OpenAI</strong> — Direct OpenAI API access</li>
        <li>• <strong>Anthropic</strong> — Claude API</li>
        <li>• <strong>Any OpenAI-compatible provider</strong></li>
      </ul>

      <div class="bg-neutral-950 border border-neutral-800 rounded p-4">
        <p class="text-neutral-300 font-medium mb-2">Account-Level API Key</p>
        <p class="text-neutral-400 text-sm mb-3">Store your key once, use it for all sessions:</p>
        <CodeBlock
          language="json"
          className="text-sm text-neutral-300 overflow-x-auto"
          code={`POST /api/user/keys
{"provider": "openrouter", "key": "sk-or-v1-..."}`}
        />
      </div>

      <div class="bg-neutral-950 border border-neutral-800 rounded p-4 mt-4">
        <p class="text-neutral-300 font-medium mb-2">Per-Session API Key</p>
        <p class="text-neutral-400 text-sm mb-3">Override the account key for a specific session:</p>
        <CodeBlock
          language="json"
          className="text-sm text-neutral-300 overflow-x-auto"
          code={`POST /api/sessions/{id}/nodes
{"name": "Agent", "agentType": "pi", "model": "...", "apiKey": "sk-or-v1-..."}`}
        />
      </div>
    </div>
  </section>

  <!-- WebSocket Protocol -->
  <section class="mb-16">
    <h2 class="text-2xl font-medium text-neutral-200 mb-6">WebSocket Chat Protocol</h2>
    
    <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
      <p class="text-neutral-400 mb-4">
        Agents communicate via WebSocket using the Cloudflare AIChatAgent protocol. Connect to your agent node and start chatting.
      </p>

      <h3 class="text-lg font-medium text-neutral-200 mb-3">Connection</h3>
      <CodeBlock
        language="bash"
        className="bg-neutral-950 border border-neutral-800 rounded p-4 text-sm text-neutral-300 overflow-x-auto mb-4"
        code={`wss://api.myfilepath.com/agents/chat-agent/{nodeId}`}
      />

      <h3 class="text-lg font-medium text-neutral-200 mb-3">Message Format</h3>
      <CodeBlock
        language="json"
        className="bg-neutral-950 border border-neutral-800 rounded p-4 text-sm text-neutral-300 overflow-x-auto mb-4"
        code={`# Send message
{
  "type": "cf_agent_use_chat_request",
  "id": "req-123",
  "init": {
    "method": "POST",
    "headers": {"Content-Type": "application/json"},
    "body": JSON.stringify({
      "messages": [{
        "id": "1",
        "role": "user",
        "parts": [{"type": "text", "text": "Hello!"}]
      }]
    })
  }
}`}
      />

      <h3 class="text-lg font-medium text-neutral-200 mb-3">Response Events</h3>
      <ul class="space-y-2 text-neutral-400 text-sm">
        <li>• <code>cf_agent_chat_messages</code> — Full message list sync</li>
        <li>• <code>cf_agent_use_chat_response</code> — Streaming response chunks</li>
        <li>• <code>cf_agent_stream_resuming</code> — Resume interrupted streams</li>
        <li>• <code>cf_agent_chat_request_cancel</code> — Cancel current request</li>
      </ul>
    </div>
  </section>

  <!-- Example: Complete Workflow -->
  <section class="mb-16">
    <h2 class="text-2xl font-medium text-neutral-200 mb-6">Complete Example</h2>
    
    <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
      <p class="text-neutral-400 mb-4">Here's a complete Python example:</p>
      <CodeBlock
        language="python"
        className="bg-neutral-950 border border-neutral-800 rounded p-4 text-sm text-neutral-300 overflow-x-auto"
        code={`import requests
import json
import websocket

BASE_URL = "https://myfilepath.com"
EMAIL = "agent@example.com"
PASSWORD = "secure-password"
OPENROUTER_KEY = "sk-or-v1-..."

# 1. Sign up
signup_resp = requests.post(f"{BASE_URL}/api/auth/sign-up/email", json={
    "email": EMAIL,
    "password": PASSWORD,
    "name": "My Agent"
})
print(f"Signed up: {signup_resp.status_code}")

# 2. Sign in
login_resp = requests.post(f"{BASE_URL}/api/auth/sign-in/email", json={
    "email": EMAIL,
    "password": PASSWORD
})
session_cookie = login_resp.cookies.get('session')
headers = {"Cookie": f"session={session_cookie}"}

# 3. Store API key
requests.post(f"{BASE_URL}/api/user/keys", 
    headers=headers,
    json={"provider": "openrouter", "key": OPENROUTER_KEY}
)

# 4. Create session
session_resp = requests.post(f"{BASE_URL}/api/sessions",
    headers=headers,
    json={"name": "Research Task"}
)
session_id = session_resp.json()['id']

# 5. Spawn agent
node_resp = requests.post(f"{BASE_URL}/api/sessions/{session_id}/nodes",
    headers=headers,
    json={
        "name": "Pi",
        "agentType": "pi",
        "model": "anthropic/claude-sonnet-4"
    }
)
node_id = node_resp.json()['id']

# 6. Chat via WebSocket
def on_message(ws, message):
    data = json.loads(message)
    if data['type'] == 'cf_agent_use_chat_response':
        print(data.get('body', ''), end='')

ws = websocket.WebSocketApp(
    f"wss://api.myfilepath.com/agents/chat-agent/{node_id}",
    on_message=on_message
)

# Send a message
ws.send(json.dumps({
    "type": "cf_agent_use_chat_request",
    "id": "msg-1",
    "init": {
        "method": "POST",
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({
            "messages": [{
                "id": "1",
                "role": "user",
                "parts": [{"type": "text", "text": "Explain quantum computing"}]
            }]
        })
    }
}))

ws.run_forever()`}
      />
    </div>
  </section>

  <!-- Need Help -->
  <section>
    <h2 class="text-2xl font-medium text-neutral-200 mb-6">Need Help?</h2>
    
    <div class="grid md:grid-cols-3 gap-4">
      <a href="https://github.com/acoyfellow/filepath/issues" class="block bg-neutral-900 border border-neutral-800 rounded-lg p-6 hover:border-neutral-700 transition-colors">
        <h3 class="font-medium text-neutral-200 mb-2">GitHub Issues</h3>
        <p class="text-neutral-400 text-sm">Report bugs or request features</p>
      </a>

      <a href="/docs" class="block bg-neutral-900 border border-neutral-800 rounded-lg p-6 hover:border-neutral-700 transition-colors">
        <h3 class="font-medium text-neutral-200 mb-2">Documentation</h3>
        <p class="text-neutral-400 text-sm">Guides, tutorials, and references</p>
      </a>

      <div class="block bg-neutral-900 border border-neutral-800 rounded-lg p-6">
        <h3 class="font-medium text-neutral-200 mb-2">API Status</h3>
        <p class="text-neutral-400 text-sm">Check /api/config for current status</p>
      </div>
    </div>
  </section>

  <footer class="mt-16 pt-8 border-t border-neutral-800 text-center">
    <p class="text-neutral-500 text-sm">
      filepath — The platform for agents. 
      <a href="https://github.com/acoyfellow/filepath" class="text-neutral-300 hover:underline">Open source on GitHub</a>
    </p>
  </footer>
</main>
