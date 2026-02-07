# AGENTS.md - myfilepath.com

Agent instructions for the myfilepath.com codebase.

## Project Context

**Product:** myfilepath.com — Multi-agent orchestration platform  
**Stack:** Cloudflare Workers + Agents SDK + SvelteKit + D1 + Alchemy  
**Sprint:** Multi-agent session orchestration (Feb 2026)

## Current Status (Feb 2026)

✅ **Working:**
- Build passes (`bunx tsc --noEmit` clean)
- SvelteKit UI (landing, auth, dashboard, wizard, session view, settings)
- Better-auth (email/password, API keys)
- Stripe billing (checkout, webhooks, credits)
- Secrets encryption (AES-GCM)
- Agents SDK foundation (TaskAgent DO + Workflows)
- Terminal containers (ttyd + Cloudflare Containers)
- Production gates in CI (visual regression, terminal, credit, billing)
- Agent catalog (7 agent types: shelley, pi, opencode, codex, amp, claude-code, custom)
- Multi-agent DB schema (`multi_agent_session` + `agent_slot` tables)
- Multi-agent CRUD API (`/api/session/multi/*`)
- Session wizard (4-step: basics → orchestrator → workers → review)
- 3-panel session view (sidebar, chat panel, worker tabs)
- Conductor type interface (typed orchestration API)
- Shared components (AgentConfigEditor, statusColors, ChatMessage)

🔄 **In Progress:**
- Container spin-up for agent slots
- Agent execution inside containers
- Progress streaming from agents to UI
- Per-minute credit deduction

❌ **Not Started:**
- Real conductor implementation (types exist, no runtime yet)
- Inter-agent communication (orchestrator ↔ workers)
- Git repo cloning into containers
- Session pause/resume
- E2E multi-agent test

## Architecture

```
User → Wizard → Multi-Agent Session → Agent Slots → Containers
                     ↓                     ↓            ↓
               D1 metadata          Config/Status   Execution
               Conductor API        Model/Router    (ttyd+bash)
```

### Core Components

| Component | File | Purpose |
|-----------|------|---------|
| TaskAgent | `src/agent/task-agent.ts` | Main DO (dual RPC+REST interface) |
| ExecuteTaskWorkflow | `src/agent/workflows/execute-task.ts` | Run commands in containers |
| CreateSessionWorkflow | `src/agent/workflows/create-session.ts` | Spawn container sessions |
| Agent Catalog | `src/lib/agents/catalog.ts` | Registry of 7 agent types |
| Session Types | `src/lib/types/session.ts` | AgentSlot, MultiAgentSession, ModelId |
| Conductor | `src/lib/types/conductor.ts` | Orchestration API interface |
| Wizard | `src/lib/components/wizard/` | 4-step session creation |
| Session View | `src/lib/components/session/` | 3-panel layout |

### Dual Interface Pattern

```typescript
// @callable = primary interface (RPC, typed, streaming)
@callable()
async executeTask(sessionId: string, task: string, apiKey: string) { ... }

// fetch() = thin REST wrapper
async fetch(request: Request) {
  const apiKey = request.headers.get('x-api-key');
  return await this.executeTask(sessionId, task, apiKey);
}
```

## Development

```bash
bun install
bun run dev          # localhost:5173
bash gates/health.sh # Health check (skips tsc — too slow on this VM)
bun run deploy       # Deploy via Alchemy
# bunx tsc --noEmit  # Takes ~10 min on this VM. CI catches type errors. Run only when needed.
```

## Code Rules

### Svelte 5 Syntax (CRITICAL)
```svelte
<!-- ❌ WRONG --><button on:click={fn}>   <!-- ✅ RIGHT --><button onclick={fn}>
<!-- ❌ WRONG --><form on:submit|preventDefault>  <!-- ✅ RIGHT --><form onsubmit={(e) => { e.preventDefault(); ... }}>
```

### TypeScript
- No explicit `any` — use `unknown`, generics, or specific types
- No implicit returns in non-void functions
- `arr[0]` is `T | undefined` (noUncheckedIndexedAccess)

### Commit Discipline
1. **DO NOT run `bunx tsc --noEmit`** — takes ~10min on this VM. CI catches type errors.
2. Commit after EVERY file change
3. Descriptive commit messages
4. Run `bash gates/health.sh` between phases (quick — checks syntax, svelte5, any)

## Key Files

```
src/
├── agent/
│   ├── task-agent.ts            # Main Durable Object
│   └── workflows/               # ExecuteTask, CreateSession
├── lib/
│   ├── agents/catalog.ts        # 7 agent types
│   ├── types/session.ts         # AgentSlot, MultiAgentSession, etc.
│   ├── types/conductor.ts       # Conductor orchestration interface
│   ├── components/session/      # ChatPanel, SessionSidebar, WorkerTabs
│   ├── components/wizard/       # StepBasics, StepOrchestrator, StepWorkers, StepReview
│   ├── schema.ts                # Drizzle D1 schema
│   └── auth.ts                  # Better-auth config
├── routes/
│   ├── session/new/             # Wizard page
│   ├── session/[id]/            # 3-panel session view
│   ├── dashboard/               # Session list
│   ├── api/session/multi/       # CRUD endpoints
│   └── settings/                # API keys, billing, account
gates/                           # Health + production gates
alchemy.run.ts                   # Infrastructure config (NOT wrangler)
```

## API Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/session/multi` | POST | Cookie | Create multi-agent session |
| `/api/session/multi?id=X` | GET | Cookie | Get session + slots |
| `/api/session/multi/list` | GET | Cookie | List sessions |
| `/api/session/multi/chat` | POST | Cookie | Message an agent |
| `/api/session/multi/stop` | POST | Cookie | Stop session |
| `/api/orchestrator` | POST | x-api-key | Execute task (legacy) |
| `/api/billing/checkout` | POST | Cookie | Stripe checkout |
| `/api/billing/balance` | GET | Cookie | Credit balance |

## Gates

| Gate | File | Status |
|------|------|--------|
| Health | `gates/health.sh` | ✅ |
| Signup | `gates/signup.gate.sh` | ✅ |
| Login | `gates/login.gate.sh` | ✅ |
| API Keys | `gates/api-e2e.gate.sh` | ✅ |
| Terminal | `gates/terminal.gate.sh` | ✅ |
| Orchestrator | `gates/orchestrator.gate.sh` | ✅ |
| Full E2E | `gates/full-user-lifecycle.gate.sh` | ✅ |
| Production (CI) | `gates/production/run-all.sh` | ✅ |

## ⚠️ CRITICAL: Use Alchemy, NOT Wrangler

- ❌ `wrangler deploy`, `wrangler.toml`
- ✅ `bun run deploy` (runs `alchemy deploy`)
- Config lives in `alchemy.run.ts`

## Footguns

1. **ttyd needs size message** — send `{columns:80, rows:24}` on WS connect
2. **Skip `waitForPort`** in prod — let WS retry handle ttyd startup
3. **SvelteKit can't proxy WebSocket** — terminal WS goes direct to worker
4. **Sandbox binding** — must point to correct container namespace (was stale, fixed)
5. **Use `bun`/`bunx`** not npm/npx

## Sprint Priorities (Next)

1. Wire agent slots to real containers (slot.containerId → running container)
2. Agent execution — start agent binary in container, stream output
3. Chat → agent routing (ChatPanel → API → container stdin)
4. Credit deduction per minute of container runtime
5. Conductor runtime implementation (beyond types)
