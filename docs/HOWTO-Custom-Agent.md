# How to Add a Custom Agent

A step-by-step guide to bring your own agent to filepath.

## What you'll build

A Docker container that:
- Receives tasks via environment variables
- Reads user messages from stdin (NDJSON)
- Emits events to stdout (NDJSON)
- Runs in an isolated Linux environment

## Prerequisites

- Docker installed locally
- filepath account with API key configured
- Basic understanding of NDJSON (one JSON object per line)

## Step 1: Create the Dockerfile

Create a new directory for your agent:

```bash
mkdir my-custom-agent
cd my-custom-agent
```

Create `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /workspace

# Copy your agent code
COPY package.json .
COPY index.js .

RUN npm install

# The container starts here
CMD ["node", "index.js"]
```

## Step 2: Write the Agent Code

Create `index.js`:

```javascript
const readline = require('readline');

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
  content: `Starting task: ${task}`
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
        content: `Received: ${msg.content}`
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
});
```

Create `package.json`:

```json
{
  "name": "my-custom-agent",
  "version": "1.0.0",
  "main": "index.js"
}
```

## Step 3: Test Locally

Build and test your container:

```bash
# Build
docker build -t my-custom-agent .

# Test locally
echo '{"type":"message","content":"hello"}' | docker run -i \
  -e FILEPATH_TASK="Test task" \
  -e FILEPATH_API_KEY="sk-test" \
  -e FILEPATH_MODEL="anthropic/claude-sonnet-4.5" \
  my-custom-agent
```

You should see NDJSON output.

## Step 4: Push to Registry

Push your image to a container registry:

```bash
# Tag for registry
docker tag my-custom-agent:latest ghcr.io/YOURNAME/my-custom-agent:latest

# Push
docker push ghcr.io/YOURNAME/my-custom-agent:latest
```

## Step 5: Register in filepath

Currently, custom agents are added via PR to the filepath repo:

1. Fork https://github.com/acoyfellow/filepath
2. Edit `src/lib/agents/catalog.ts`
3. Add your agent:

```typescript
export const ADAPTER_COMMANDS: Record<string, string> = {
  // ... existing agents
  'my-custom': 'node /opt/filepath/adapters/my-custom/index.js',
};

export const AGENT_IMAGES: Record<string, string> = {
  // ... existing agents
  'my-custom': 'ghcr.io/YOURNAME/my-custom-agent:latest',
};
```

4. Submit PR

After merge, your agent appears in the spawn dropdown.

## Event Reference

Your agent should emit these event types:

### `text`
```json
{"type":"text","content":"Hello from agent"}
```

### `tool`
```json
{"type":"tool","name":"git","status":"success","path":"/workspace"}
```

### `command`
```json
{"type":"command","command":"npm install"}
```

### `commit`
```json
{"type":"commit","message":"Fix bug","sha":"abc123"}
```

### `spawn`
```json
{"type":"spawn","agent":"worker-1","name":"Refactor auth"}
```

### `status`
```json
{"type":"status","state":"thinking"}
```

### `done`
```json
{"type":"done"}
```

## Input Events

Your agent receives these on stdin:

### `message`
```json
{"type":"message","from":"user","content":"Focus on auth"}
```

### `signal`
```json
{"type":"signal","action":"stop"}
```

## Best Practices

1. **Flush stdout** after each JSON line: `console.log(JSON.stringify(obj))`
2. **Handle SIGTERM** gracefully - save state and exit
3. **Validate input** - don't crash on malformed JSON
4. **Emit status** - let users know when you're working vs idle
5. **Use workspace** - `/workspace` is where the repo lives

## Troubleshooting

**Container not starting**
→ Check image is public or registry is accessible

**No output in chat**
→ Verify stdout is flushed, not buffered

**JSON errors**
→ Validate your output is one line per event

**Environment variables missing**
→ Check FILEPATH_* vars are set in container

## Example: Python Agent

```python
import json
import sys
import os

task = os.environ.get('FILEPATH_TASK', '')

print(json.dumps({'type': 'status', 'state': 'running'}))
print(json.dumps({'type': 'text', 'content': f'Task: {task}'}))

for line in sys.stdin:
    try:
        msg = json.loads(line)
        if msg.get('type') == 'message':
            print(json.dumps({
                'type': 'text',
                'content': f'Got: {msg.get("content")}'
            }))
            print(json.dumps({'type': 'done'}))
    except:
        pass
```

## Next Steps

- Read the [Protocol Spec](../NORTHSTAR.md) for full details
- Check [Agent Catalog](../AGENTS.md) for reference implementations
- Join discussions at https://github.com/acoyfellow/filepath/discussions
