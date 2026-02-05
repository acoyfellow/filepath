# AGENTS.md - myfilepath.com

Agent instructions for the myfilepath.com codebase.

## Project Context

**Product:** myfilepath.com - The platform for agents  
**Goal:** Orchestration layer + coey.dev ecosystem integration  
**Architecture:** Cloudflare Agents SDK with dual interface pattern

## Current Status (Feb 2026)

✅ **Working:**
- Build passes (`npx tsc --noEmit` clean)
- SvelteKit UI (landing, auth, dashboard, settings)
- Better-auth (email/password, API keys)
- Stripe billing (checkout, webhooks, credits)
- Secrets encryption (AES-GCM)
- Agents SDK foundation (TaskAgent DO)
- Workflow classes defined

🔄 **In Progress:**
- Container integration in workflows
- Real API key validation
- Progress streaming

❌ **Not Done:**
- E2E agent test automation
- Production container execution

## Architecture Overview

```
Agent/Human → TaskAgent (DO) → Workflows → Containers
              ↓                    ↓          ↓
           API Keys          Long-running  Execution
           Streaming         Orchestration Environment
```

### Core Components

| Component | Purpose | File |
|-----------|---------|------|
| TaskAgent | Durable Object for request handling | `src/agent/task-agent.ts` |
| ExecuteTaskWorkflow | Run commands in containers | `src/agent/workflows/execute-task.ts` |
| CreateSessionWorkflow | Spawn container sessions | `src/agent/workflows/create-session.ts` |
| Containers | Isolated execution (ttyd + bash) | Cloudflare Containers |

### Dual Interface Pattern

TaskAgent provides both RPC and REST with zero duplication:

```typescript
// RPC - primary interface (@callable methods)
@callable()
async executeTask(sessionId: string, task: string, apiKey: string) {
  // Core logic
}

// REST - thin wrapper extracts API key, calls RPC
async fetch(request: Request) {
  const apiKey = request.headers.get('x-api-key');
  const { sessionId, task } = await request.json();
  return await this.executeTask(sessionId, task, apiKey);
}
```

**Why:** Single source of truth in `@callable` methods. REST is just routing.

## Development Commands

```bash
# Build check (ALWAYS run before commit)
npx tsc --noEmit

# Health check (comprehensive)
bash gates/health.sh

# Local dev
npm run dev

# Deploy
npm run deploy
```

## Code Style Requirements

### Svelte 5 Syntax (CRITICAL)

```svelte
<!-- ❌ WRONG - Svelte 4 -->
<button on:click={handler}>Click</button>
<form on:submit|preventDefault={submit}>...

<!-- ✅ RIGHT - Svelte 5 -->
<button onclick={handler}>Click</button>
<form onsubmit={(e) => { e.preventDefault(); submit(); }}>...
```

### TypeScript Rules

- No explicit `any` - use `unknown`, generics, or specific types
- No implicit returns in non-void functions
- `arr[0]` is `T | undefined` (noUncheckedIndexedAccess)

### Commit Discipline

1. Run `npx tsc --noEmit` before every commit
2. Commit after EVERY file change (not "frequently")
3. Use descriptive commit messages

## Key Files

```
src/
├── agent/
│   ├── task-agent.ts         # Main Durable Object
│   └── workflows/
│       ├── execute-task.ts   # Command execution
│       └── create-session.ts # Container spawning
├── lib/
│   ├── auth/                 # Better-auth config
│   ├── crypto/secrets.ts     # AES-GCM encryption
│   └── server/               # Server utilities
├── routes/
│   ├── api/                  # API endpoints
│   ├── dashboard/            # Session management
│   ├── session/[id]/         # Terminal UI
│   └── settings/             # API keys, billing
alchemy.run.ts                # Infrastructure config
gates/health.sh               # Pre-commit checks
```

## API Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|--------|
| `/api/orchestrator` | POST | x-api-key | Execute task |
| `/api/orchestrator/session` | POST | x-api-key | Create session |
| `/api/auth/*` | - | Cookie | Better-auth routes |
| `/api/billing/*` | POST | Cookie | Stripe integration |

## Footguns

### ttyd requires initial size message
WebSocket connects but terminal shows nothing? Send size first:
```typescript
ttydWs.send(JSON.stringify({ columns: 80, rows: 24 }));
```

### Skip waitForPort in production
`sandbox.waitForPort()` times out. Let WebSocket retry handle ttyd startup.

### SvelteKit cannot proxy WebSocket
- HTTP → SvelteKit → Worker (OK)
- WebSocket → Worker directly (required)

## Debugging

```bash
# Check GitHub Actions
gh run list --limit 5
gh run view <RUN_ID> --log 2>/dev/null | tail -100

# Check Cloudflare logs
npx wrangler tail --format pretty

# Local container testing
npx wrangler dev --local
```

## Integration Points

- **coey.dev** - Parent ecosystem
- **Deja** - Cross-session agent memory
- **Stripe** - Payment processing
- **D1** - Auth & metadata storage
- **Cloudflare Containers** - Execution sandboxes

## Sprint Priorities

1. Container integration in ExecuteTaskWorkflow
2. Real API key validation
3. Progress streaming to clients
4. E2E agent test automation
