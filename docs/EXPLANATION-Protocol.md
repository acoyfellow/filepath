# Understanding the filepath Agent Protocol (FAP)

A conceptual guide to how agents communicate.

## The Core Idea

filepath agents are **processes that speak JSON over pipes**.

Think of it like a chatbot that:
- **Receives messages** on stdin (what the user says)
- **Sends responses** on stdout (what the agent says)
- **Runs in a container** (isolated environment)

The innovation is making this **structured and persistent**.

## Why NDJSON?

NDJSON = Newline Delimited JSON

```
{"type":"message","from":"user","content":"hello"}\n
{"type":"text","content":"Hi there!"}\n
{"type":"tool","name":"ls","status":"success"}\n
{"type":"done"}\n
```

**Why not plain text?**
- Plain text: "I'm working on it..."
- Structured: `{type:"status",state:"thinking"}`

Structure lets the UI:
- Show progress bars
- Render tool calls specially
- Link to generated files
- Track costs per operation

**Why not gRPC/GraphQL?**
- Too complex for containers
- Requires libraries
- Hard to debug

NDJSON is:
- Universal (every language can print JSON)
- Debuggable (cat log | jq)
- Streaming (process events as they arrive)
- Simple (no dependencies)

## The Two Directions

### filepath → Agent (Input)

**Medium:** stdin (standard input)

**Events:**

| Type | When | Payload |
|------|------|---------|
| `message` | User sends chat | `{type,from,content}` |
| `signal` | User wants to stop | `{type,action}` |

**Example flow:**

```javascript
// Agent reads stdin line-by-line
const rl = readline.createInterface({input: process.stdin});

rl.on('line', (line) => {
  const msg = JSON.parse(line);
  
  if (msg.type === 'message') {
    // User said something, respond
    handleUserMessage(msg.content);
  }
  
  if (msg.type === 'signal' && msg.action === 'stop') {
    // User wants to stop, cleanup
    saveState();
    process.exit(0);
  }
});
```

### Agent → filepath (Output)

**Medium:** stdout (standard output)

**Events:**

| Type | Purpose | Example |
|------|---------|---------|
| `text` | Assistant message | "I'll fix that for you" |
| `tool` | Tool execution result | grep found 3 files |
| `command` | Shell command | npm install |
| `commit` | Git commit made | "Fix auth bug" |
| `spawn` | Child agent request | "Spawn a tester" |
| `status` | State change | thinking → running |
| `done` | Task complete | - |

**Example flow:**

```javascript
// Agent emits events
function emit(event) {
  console.log(JSON.stringify(event));
  // Must flush!
}

// Working on task
emit({type: 'status', state: 'thinking'});

// Found something
emit({
  type: 'text',
  content: 'I found the issue in auth.js'
});

// Ran a command
emit({
  type: 'command',
  command: 'grep -r "auth" src/'
});

// Made commit
emit({
  type: 'commit',
  message: 'Fix auth bug',
  sha: 'abc123'
});

// Done
emit({type: 'done'});
emit({type: 'status', state: 'idle'});
```

## The Environment

Agents receive context through environment variables:

```bash
FILEPATH_TASK="Fix authentication in login flow"
FILEPATH_API_KEY="sk-or-v1-xxx"
FILEPATH_MODEL="anthropic/claude-sonnet-4.5"
FILEPATH_AGENT_ID="node-abc-123"
FILEPATH_SESSION_ID="session-xyz-789"
FILEPATH_WORKSPACE="/workspace"
```

**Why env vars?**
- Set once at startup
- Don't change during execution
- Easy to access in any language
- Secure (not visible in logs usually)

**The workspace:**
- `/workspace` is where files live
- If user provided git repo, it's cloned here
- Agent can read/write files freely
- Persists across container restarts

## State Management

### What State?

Agents can maintain state across messages:

```javascript
// Global state (survives multiple user messages)
let currentTask = null;
let filesModified = [];

rl.on('line', (line) => {
  const msg = JSON.parse(line);
  
  if (msg.type === 'message') {
    // Access previous state
    if (currentTask) {
      // Continue from where we left off
    } else {
      // Start fresh
      currentTask = msg.content;
    }
  }
});
```

### Why It Works

- Container **sleeps** after idle (saves money)
- Container **wakes** on new message (fast)
- Filesystem **persists** (state in /workspace)
- Process memory **clears** on sleep (acceptable)

**For long-term state:** Use `/workspace/state.json`

```javascript
// Save state
fs.writeFileSync('/workspace/state.json', JSON.stringify({
  task: currentTask,
  progress: 0.7
}));

// Load state
try {
  const state = JSON.parse(fs.readFileSync('/workspace/state.json'));
  currentTask = state.task;
} catch (e) {
  // No previous state
}
```

## Error Handling

### Agent Crashes

**What happens:**
1. filepath detects stdout closed / process died
2. filepath broadcasts error to UI
3. filepath attempts restart (configurable)
4. User sees error, can retry

**Prevention:**
```javascript
// Wrap everything
try {
  main();
} catch (e) {
  // Emit error before dying
  emit({
    type: 'text',
    content: `Error: ${e.message}`
  });
  emit({type: 'done'});
  process.exit(1);
}
```

### Invalid Output

**What happens:**
1. filepath tries to parse line as JSON
2. Parse fails
3. filepath logs line to console (for debugging)
4. filepath continues (doesn't crash)

**Prevention:**
```javascript
// Always emit valid JSON
function safeEmit(event) {
  try {
    console.log(JSON.stringify(event));
  } catch (e) {
    console.log(JSON.stringify({
      type: 'text',
      content: 'Error: Could not serialize event'
    }));
  }
}
```

## Protocol Versioning

**Current:** FAP v1.0

Version is implicit. filepath supports:
- Required fields: `type`
- Optional fields: everything else
- Unknown types: logged but not crashed

**Future versions:**
- Will be backward compatible
- New event types added
- Old agents continue working

## Building Your Own Agent

### Minimum Viable Agent

```javascript
// index.js
const readline = require('readline');

const task = process.env.FILEPATH_TASK;
const apiKey = process.env.FILEPATH_API_KEY;

console.log(JSON.stringify({
  type: 'text',
  content: `I'll handle: ${task}`
}));

const rl = readline.createInterface({input: process.stdin});

rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line);
    
    if (msg.type === 'message') {
      // Do work here
      console.log(JSON.stringify({
        type: 'text',
        content: `Working on: ${msg.content}`
      }));
      
      // Finish
      console.log(JSON.stringify({type: 'done'}));
    }
  } catch (e) {
    // Ignore bad input
  }
});
```

### Dockerize

```dockerfile
FROM node:20-alpine
WORKDIR /workspace
COPY index.js .
CMD ["node", "index.js"]
```

### Test

```bash
# Build
docker build -t my-agent .

# Test
echo '{"type":"message","content":"test"}' | \
  docker run -i \
  -e FILEPATH_TASK="test" \
  -e FILEPATH_API_KEY="sk-xxx" \
  my-agent
```

That's it. Any language, any framework, as long as it:
1. Reads env vars
2. Reads stdin (JSON lines)
3. Writes stdout (JSON lines)

## Comparison to Other Protocols

### vs MCP (Model Context Protocol)

**MCP:** Server-based, HTTP/WebSocket, structured tools
**FAP:** Process-based, stdin/stdout, streaming NDJSON

**When to use FAP:**
- Container-based agents
- Long-running processes
- Simple implementation

**When to use MCP:**
- External services
- HTTP-native tools
- Structured capabilities

(filepath may support MCP in future)

### vs OpenAI Assistants API

**OpenAI:** Managed threads, messages, runs
**FAP:** You manage everything in a container

**FAP advantages:**
- Full control over execution
- Use any model (not just OpenAI)
- Files in real filesystem
- No API rate limits from us

### vs LangChain/LlamaIndex

**Frameworks:** Libraries for building agent logic
**FAP:** Protocol for agent communication

**They're complementary:**
- Build agent with LangChain
- Speak FAP to filepath
- Get persistence + UI + containers

## Mental Model

Think of filepath as:

```
┌─────────────────────────────────────┐
│  filepath Infrastructure            │
│                                     │
│  ┌──────────────┐  ┌────────────┐  │
│  │  Container   │  │  Database  │  │
│  │  (your code) │  │  (history) │  │
│  └──────────────┘  └────────────┘  │
│         │                 ↑        │
│         │ reads/writes    │        │
│         ↓                 │        │
│  ┌────────────────────────────────┐ │
│  │  ChatAgent DO                  │ │
│  │  - Manages connections         │ │
│  │  - Persists state               │ │
│  │  - Handles protocol             │ │
│  └────────────────────────────────┘ │
│         ↑↓ WebSocket                 │
│  ┌────────────────────────────────┐  │
│  │  Browser (Tree + Chat UI)      │  │
│  └────────────────────────────────┘  │
└─────────────────────────────────────┘
```

You write the container code.
filepath handles everything else.

## Summary

FAP is simple:
- **In:** User messages on stdin
- **Out:** Agent events on stdout
- **Context:** Env vars at startup
- **State:** Files in /workspace

The power comes from:
- Persistence (survive restarts)
- Isolation (container security)
- Streaming (real-time updates)
- Structure (rich UI possible)

That's filepath.
