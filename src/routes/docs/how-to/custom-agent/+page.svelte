<script lang="ts">
  import Nav from '$lib/components/Nav.svelte';
  import CodeBlock from '$lib/components/CodeBlock.svelte';
</script>

<svelte:head>
  <title>How to Add a Custom Agent | filepath</title>
  <meta name="description" content="Build and integrate your own agent into filepath. Step-by-step guide for BYO (bring your own) Docker containers." />
</svelte:head>

<Nav />

<main class="max-w-3xl mx-auto px-6 py-12">
  <div class="mb-8">
    <a href="/docs" class="text-neutral-500 hover:text-neutral-300 text-sm">Back to Docs</a>
  </div>

  <h1 class="text-3xl font-medium text-neutral-100 mb-4">How to Add a Custom Agent</h1>
  <p class="text-neutral-400 mb-8">Build a Docker container that speaks the filepath Agent Protocol (FAP) and integrate it into the platform.</p>

  <div class="prose prose-invert prose-neutral max-w-none">
    <h2 class="text-xl font-medium text-neutral-200 mt-8 mb-4">What you'll build</h2>
    <p class="text-neutral-400 mb-4">A Docker container that:</p>
    <ul class="space-y-2 text-neutral-400 mb-6">
      <li>• Receives tasks via environment variables</li>
      <li>• Reads user messages from stdin (NDJSON)</li>
      <li>• Emits events to stdout (NDJSON)</li>
      <li>• Runs in an isolated Linux environment</li>
    </ul>

    <h2 class="text-xl font-medium text-neutral-200 mt-8 mb-4">Prerequisites</h2>
    <ul class="space-y-2 text-neutral-400 mb-6">
      <li>• Docker installed locally</li>
      <li>• filepath account with API key configured</li>
      <li>• Basic understanding of NDJSON (one JSON object per line)</li>
    </ul>

    <h2 class="text-xl font-medium text-neutral-200 mt-8 mb-4">Step 1: Create the Dockerfile</h2>
    <p class="text-neutral-400 mb-4">Create a new directory for your agent:</p>
    <CodeBlock
      language="bash"
      className="bg-neutral-900 border border-neutral-800 rounded p-4 text-sm text-neutral-300 overflow-x-auto mb-6"
      code={`mkdir my-custom-agent
cd my-custom-agent`}
    />

    <p class="text-neutral-400 mb-4">Create <code class="bg-neutral-800 px-2 py-1 rounded text-sm">Dockerfile</code>:</p>
    <CodeBlock
      language="bash"
      className="bg-neutral-900 border border-neutral-800 rounded p-4 text-sm text-neutral-300 overflow-x-auto mb-6"
      code={`FROM node:20-alpine

WORKDIR /workspace

# Copy your agent code
COPY package.json .
COPY index.js .

RUN npm install

# The container starts here
CMD ["node", "index.js"]`}
    />

    <h2 class="text-xl font-medium text-neutral-200 mt-8 mb-4">Step 2: Write the Agent Code</h2>
    <p class="text-neutral-400 mb-4">Create <code class="bg-neutral-800 px-2 py-1 rounded text-sm">index.js</code>:</p>
    <CodeBlock
      language="javascript"
      className="bg-neutral-900 border border-neutral-800 rounded p-4 text-sm text-neutral-300 overflow-x-auto mb-6"
      code={`const readline = require('readline');

// Read environment variables from filepath
const task = process.env.FILEPATH_TASK || '';
const apiKey = process.env.FILEPATH_API_KEY || '';
const model = process.env.FILEPATH_MODEL || '';
const agentId = process.env.FILEPATH_AGENT_ID || '';

// Startup message
console.log(JSON.stringify({
  type: 'status',
  state: 'running'
}));

console.log(JSON.stringify({
  type: 'text',
  content: \`Starting task: \${task}\`
}));

// Read user messages from stdin
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async (line) => {
  try {
    const msg = JSON.parse(line);

    if (msg.type === 'message') {
      // Echo back for demo purposes
      console.log(JSON.stringify({
        type: 'text',
        content: \`Received: \${msg.content}\`
      }));

      // Simulate some work
      console.log(JSON.stringify({
        type: 'command',
        command: 'echo "Processing..."'
      }));

      // Mark as done
      console.log(JSON.stringify({
        type: 'done'
      }));
    }
  } catch (e) {
    console.log(JSON.stringify({
      type: 'text',
      content: 'Error parsing input'
    }));
  }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log(JSON.stringify({
    type: 'status',
    state: 'idle'
  }));
  process.exit(0);
});`}
    />
    <p class="text-neutral-400 mb-4">Create <code class="bg-neutral-800 px-2 py-1 rounded text-sm">package.json</code>:</p>
    <CodeBlock
      language="json"
      className="bg-neutral-900 border border-neutral-800 rounded p-4 text-sm text-neutral-300 overflow-x-auto mb-6"
      code={`{"name": "my-custom-agent", "version": "1.0.0", "main": "index.js"}`}
    />

    <h2 class="text-xl font-medium text-neutral-200 mt-8 mb-4">Step 3: Test Locally</h2>
    <p class="text-neutral-400 mb-4">Build and test your container:</p>
    <CodeBlock
      language="bash"
      className="bg-neutral-900 border border-neutral-800 rounded p-4 text-sm text-neutral-300 overflow-x-auto mb-6"
      code={`# Build
docker build -t my-custom-agent .

# Test locally
echo '{"type":"message","content":"hello"}' | docker run -i \\
  -e FILEPATH_TASK="Test task" \\
  -e FILEPATH_API_KEY="sk-test" \\
  my-custom-agent`}
    />

    <p class="text-neutral-400 mb-4">You should see NDJSON output.</p>

    <h2 class="text-xl font-medium text-neutral-200 mt-8 mb-4">Step 4: Push to Registry</h2>
    <p class="text-neutral-400 mb-4">Push your image to a container registry:</p>
    <CodeBlock
      language="bash"
      className="bg-neutral-900 border border-neutral-800 rounded p-4 text-sm text-neutral-300 overflow-x-auto mb-6"
      code={`# Tag for registry
docker tag my-custom-agent:latest ghcr.io/YOURNAME/my-custom-agent:latest

# Push
docker push ghcr.io/YOURNAME/my-custom-agent:latest`}
    />

    <h2 class="text-xl font-medium text-neutral-200 mt-8 mb-4">Step 5: Register in filepath</h2>
    <p class="text-neutral-400 mb-6">Currently, custom agents are added via PR to the filepath repo. Submit a PR adding your agent to the catalog.</p>

    <h2 class="text-xl font-medium text-neutral-200 mt-8 mb-4">Event Reference</h2>
    <p class="text-neutral-400 mb-4">Your agent should emit these event types:</p>
    <div class="space-y-3 mb-6">
      <div class="bg-neutral-900 border border-neutral-800 rounded p-3">
        <code class="text-neutral-300 text-sm">{'{'}"type":"text","content":"Hello from agent"{'}'}</code>
        <span class="text-neutral-500 text-sm ml-2">— Assistant message</span>
      </div>
      <div class="bg-neutral-900 border border-neutral-800 rounded p-3">
        <code class="text-neutral-300 text-sm">{'{'}"type":"tool","name":"git","status":"success"{'}'}</code>
        <span class="text-neutral-500 text-sm ml-2">— Tool execution</span>
      </div>
      <div class="bg-neutral-900 border border-neutral-800 rounded p-3">
        <code class="text-neutral-300 text-sm">{'{'}"type":"done"{'}'}</code>
        <span class="text-neutral-500 text-sm ml-2">— Task complete</span>
      </div>
    </div>

    <h2 class="text-xl font-medium text-neutral-200 mt-8 mb-4">Best Practices</h2>
    <ul class="space-y-2 text-neutral-400 mb-6">
      <li>• <strong>Flush stdout</strong> after each JSON line</li>
      <li>• <strong>Handle SIGTERM</strong> gracefully — save state and exit</li>
      <li>• <strong>Validate input</strong> — don't crash on malformed JSON</li>
      <li>• <strong>Emit status</strong> — let users know when you're working vs idle</li>
      <li>• <strong>Use /workspace</strong> — that's where files live</li>
    </ul>

    <div class="mt-8 p-4 bg-neutral-900/50 border border-neutral-800 rounded">
      <h3 class="text-lg font-medium text-neutral-200 mb-2">Next Steps</h3>
      <ul class="space-y-2 text-neutral-400">
        <li>• Read the <a href="/docs/explanation/protocol" class="text-neutral-300 hover:underline">Protocol Deep Dive</a> for full details</li>
        <li>• Check <a href="/docs/agents" class="text-neutral-300 hover:underline">Agent Catalog</a> for reference implementations</li>
        <li>• Join discussions on GitHub</li>
      </ul>
    </div>
  </div>
</main>
