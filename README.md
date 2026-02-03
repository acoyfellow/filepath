# myfilepath.com

The platform for agents. Persistent execution environments that survive context limits.

## Architecture (Feb 2026 - Agents SDK)

Built on **Cloudflare Agents SDK** for durable, long-running task orchestration.

```
Agent/Human → TaskAgent (DO) → Workflows → Containers
              ↓                    ↓          ↓
           API Keys          Long-running  Execution
           Streaming         Orchestration Environment
```

### Core Components

- **TaskAgent** - Durable Object handling requests, managing workflows
  - RPC methods via `@callable()` (fast, typed, streaming)
  - REST API via `fetch()` (thin wrapper for external agents)
  - WebSocket streaming (real-time progress)

- **Workflows** - Long-running task orchestration
  - `ExecuteTaskWorkflow` - Run commands in containers
  - `CreateSessionWorkflow` - Spawn new container sessions
  - Built-in SQLite state, automatic retries, progress streaming

- **Containers** - Isolated execution environments
  - One per terminal/session
  - Persistent filesystem
  - Long-lived (minutes to days)
  - Full shell access (bash, git, npm, python)

### Why Agents SDK?

**Before:** Custom DOs + manual state tracking + retry logic + WebSocket routing = lots of code

**After:** Agent class + Workflows = batteries included

- ✅ State persistence (automatic SQLite)
- ✅ Long-running tasks (days/weeks)
- ✅ Progress streaming (built-in broadcast)
- ✅ Retry logic (automatic)
- ✅ Human-in-loop (approval gates)
- ✅ Type-safe RPC

## Stack

- **Cloudflare Agents SDK** - Task orchestration & streaming
- **SvelteKit** - Frontend framework
- **Better Auth** - Authentication (humans + agents)
- **Cloudflare Workflows** - Long-running task execution
- **Cloudflare Containers** - Terminal sandboxes
- **D1** - Database for auth + metadata
- **Alchemy** - Infrastructure as code
- **Deja** - Cross-session agent memory

## Quick Start (For Agents)

### 1. Get API Key

```bash
# Sign up
curl -X POST https://myfilepath.com/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"agent@example.com","password":"secure123","name":"Agent"}'

# Login and create API key via dashboard
# https://myfilepath.com/settings/api-keys
```

### 2. Create Session

```bash
curl -X POST https://myfilepath.com/api/orchestrator/session \
  -H "x-api-key: YOUR_KEY"

# Returns: {"workflowId": "abc-123", "sessionId": "session-xyz"}
```

### 3. Execute Task

```bash
curl -X POST https://myfilepath.com/api/orchestrator \
  -H "x-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"session-xyz","task":"echo hello && ls -la"}'

# Returns: {"workflowId": "task-456"}
```

### 4. Stream Progress (WebSocket)

```javascript
const ws = new WebSocket('wss://api.myfilepath.com/agent/task-agent/default');
ws.onmessage = (msg) => console.log(JSON.parse(msg.data));
// Receives: {"workflowId": "task-456", "type": "progress", "status": "running"}
```

## Development

```bash
npm install
npm run dev        # localhost:5173
```

## UI Components (shadcn-svelte)

We use [shadcn-svelte](https://shadcn-svelte.com/) for UI components.

```bash
# Add a new component
bunx shadcn-svelte@latest add [component-name] -y

# Examples:
bunx shadcn-svelte@latest add button -y
bunx shadcn-svelte@latest add card input label dialog -y
```

Components are installed to `src/lib/components/ui/`. Import like:

```svelte
<script>
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
</script>
```

## Deploy

```bash
# Production (myfilepath.com)
npm run deploy

# Preview
npm run deploy:preview
```

## Memory System (Deja)

This project uses [Deja](https://deja.coey.dev) for cross-session agent memory.

### For Agents Using This Platform

Memory is automatically scoped to your API key. Store learnings for future sessions:

```bash
curl -X POST https://deja.coey.dev/learn \
  -H "Authorization: Bearer $DEJA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "trigger": "when working on myfilepath projects",
    "learning": "container sessions persist across disconnects",
    "confidence": 0.9
  }'
```

Query memories at session start:

```bash
curl -X POST https://deja.coey.dev/inject \
  -H "Content-Type: application/json" \
  -d '{
    "context": "working on myfilepath task",
    "format": "prompt",
    "limit": 5
  }'
```

### For Contributors

Memory is project-scoped. Set up local Deja access:

```bash
cp .env.example .env
# Add your DEJA_API_KEY
```

Contact maintainer for project-specific Deja credentials.

## Architecture Details

### Request Flow

```
1. Agent → POST /api/orchestrator (with x-api-key)
2. Worker routes to TaskAgent DO
3. TaskAgent.fetch() validates key
4. Calls @callable executeTask() method
5. Triggers ExecuteTaskWorkflow
6. Workflow spawns/reuses container
7. Executes command in container
8. Streams progress: Workflow → Agent → WebSocket clients
9. Returns result (persisted in Workflow SQLite)
```

### State Layers

- **Agent State** (DO SQLite): API key cache, session registry, WebSocket connections
- **Workflow State** (Workflow SQLite): Task params, execution steps, progress, results
- **Container State** (Filesystem): Project files, git repos, build artifacts

### Dual Interface Pattern

TaskAgent supports both RPC and REST with zero duplication:

```typescript
// RPC (fast, typed, streaming)
@callable()
async executeTask(sessionId: string, task: string, apiKey: string) {
  // Core logic here
}

// REST (thin wrapper)
async fetch(request: Request) {
  const apiKey = request.headers.get('x-api-key');
  const { sessionId, task } = await request.json();
  return await this.executeTask(sessionId, task, apiKey);
}
```

## Development Status

### ✅ Completed
- Agent SDK foundation
- TaskAgent DO with dual interface (RPC + REST)
- Workflow classes (ExecuteTask, CreateSession)
- Better-auth integration
- Stripe billing
- API key system
- SvelteKit UI
- Container infrastructure

### 🚧 In Progress (Feb 2026)
- Container integration in workflows
- Real-time progress streaming
- Workflow status polling
- E2E testing

### 📋 Roadmap
- Human-in-loop approval gates
- Multi-container orchestration
- Resource limits & billing
- MCP tool integration

## Footguns (Cloudflare Containers + ttyd)

These cost hours to debug. Don't repeat them.

### 1. ttyd requires initial size message

WebSocket connects but terminal shows nothing? ttyd waits for a size message before sending output.

```typescript
// After connecting to ttyd via sandbox.wsConnect:
await new Promise(r => setTimeout(r, 100));
ttydWs.send(JSON.stringify({ columns: 80, rows: 24 }));
```

### 2. Skip waitForPort in production

`sandbox.waitForPort()` is unreliable and times out. Let the WebSocket retry loop handle ttyd startup instead.

```typescript
// DON'T do this in prod:
await ttyd.waitForPort(7681, { mode: 'tcp', timeout: 60000 }); // Will timeout!

// DO: Just start the process and let WS retries handle it
const ttyd = await sandbox.startProcess('ttyd -W -p 7681 bash');
```

### 3. Worker needs compatibility flags for Containers

```typescript
// alchemy.run.ts
await Worker('worker', {
  compatibilityDate: "2025-11-15",
  compatibilityFlags: ["nodejs_compat"],
  observability: { enabled: true },  // For debugging
  // ...
});
```

### 4. SvelteKit cannot proxy WebSocket

Architecture must be:
- **HTTP** → SvelteKit → Worker (via server routes or service binding)
- **WebSocket** → Worker directly (api.myfilepath.com)

The terminal HTML page must connect WS to the API domain, not same origin.

### 5. Preserve request headers in wsConnect

```typescript
// Copy original request headers for ttyd handshake:
const wsHeaders = new Headers(request.headers);
if (!wsHeaders.get('Sec-WebSocket-Protocol')) {
  wsHeaders.set('Sec-WebSocket-Protocol', 'tty');
}
const wsRequest = new Request(wsUrl, { headers: wsHeaders, method: 'GET' });
```

## GitHub Actions Debugging

Deploy runs on every push. Check status and debug failures:

```bash
# List recent runs
gh run list --limit 5

# View logs for a failed run
gh run view <RUN_ID> --log 2>/dev/null | tail -100

# Quick failure diagnosis
gh run view <RUN_ID> --log 2>/dev/null | grep -A5 "error\|ERROR\|failed" | head -30

# Re-run a failed workflow
gh run rerun <RUN_ID>
```

**Common failures:**

1. **Alchemy state decryption error** - `ALCHEMY_PASSWORD` mismatch between local and GH secrets
   - Fix: Ensure `.env` ALCHEMY_PASSWORD matches the GitHub secret
   - Or reset state: delete alchemy state in Cloudflare and redeploy

2. **Type errors** - Build fails on tsc
   - Fix: Run `npx tsc --noEmit` locally and fix errors before pushing

3. **Missing secrets** - Environment variables not set
   - Check: `gh secret list` to see configured secrets
   - Required: ALCHEMY_PASSWORD, ALCHEMY_STATE_TOKEN, CLOUDFLARE_*, BETTER_AUTH_SECRET

**The health check (`gates/health.sh`) automatically checks GH Actions status.**
