# myfilepath.com

The platform for agents. Multi-agent orchestration with persistent execution environments.

## What It Does

Users configure multi-agent sessions — pick an orchestrator and workers from a catalog of coding agents (Shelley, Claude Code, Codex, etc.), give them a task and a git repo, and watch them work in parallel in isolated containers.

## Architecture

```
User → Wizard → Multi-Agent Session → Agent Slots → Containers
                     ↓                     ↓            ↓
               D1 metadata          Config/Status   Execution
               Conductor API        Model/Router    (ttyd+bash)
```

### Stack

- **Cloudflare Workers** — Hosting, edge compute
- **Agents SDK** — Durable Objects, Workflows
- **Alchemy** — Infrastructure as code (NOT wrangler)
- **SvelteKit** — Frontend (Svelte 5 syntax)
- **D1** — SQLite database (auth, sessions, agent slots)
- **Better Auth** — Email/password + API keys
- **Stripe** — Prepaid credits ($0.01/min)
- **Cloudflare Containers** — Isolated execution (ttyd terminal)

### Agent Catalog

| Agent | Icon | Roles | Default Model |
|-------|------|-------|---------------|
| Shelley | 🐚 | orchestrator, worker | claude-sonnet-4 |
| Pi | 🥧 | orchestrator, worker | claude-sonnet-4 |
| Claude Code | 🤖 | orchestrator, worker | claude-sonnet-4 |
| OpenCode | 📖 | worker | claude-sonnet-4 |
| Codex | 📜 | worker | o3 |
| Amp | ⚡ | worker | claude-sonnet-4 |
| Custom | 🔧 | orchestrator, worker | claude-sonnet-4 |

## Key Pages

| Route | Purpose |
|-------|--------|
| `/` | Landing page (redirects to dashboard if logged in) |
| `/signup`, `/login` | Auth |
| `/dashboard` | Session list (legacy terminals + multi-agent) |
| `/session/new` | Multi-agent session wizard |
| `/session/[id]` | 3-panel view: sidebar, chat, worker tabs |
| `/settings/api-keys` | API key management |
| `/settings/billing` | Credits, Stripe checkout |
| `/pricing` | Pricing page |
| `/docs` | Documentation |

## API Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|--------|
| `/api/session/multi` | POST | Cookie | Create multi-agent session |
| `/api/session/multi?id=X` | GET | Cookie | Get session + slots |
| `/api/session/multi/list` | GET | Cookie | List user's sessions |
| `/api/session/multi/chat` | POST | Cookie | Send message to agent |
| `/api/session/multi/stop` | POST | Cookie | Stop session |
| `/api/orchestrator` | POST | x-api-key | Execute task (legacy) |
| `/api/billing/checkout` | POST | Cookie | Stripe checkout |
| `/api/billing/balance` | GET | Cookie | Credit balance |

## Development

```bash
bun install
bun run dev        # localhost:5173

# Build check (ALWAYS before commit)
bunx tsc --noEmit

# Health check
bash gates/health.sh

# Deploy (uses Alchemy, never wrangler)
bun run deploy
```

## Key Directories

```
src/
├── agent/                    # Durable Objects + Workflows
│   ├── task-agent.ts         # Main DO (dual RPC+REST interface)
│   └── workflows/            # ExecuteTask, CreateSession
├── lib/
│   ├── agents/catalog.ts     # Agent registry (7 agents)
│   ├── types/session.ts      # AgentSlot, MultiAgentSession, ModelId, etc.
│   ├── types/conductor.ts    # Conductor interface (orchestration API)
│   ├── components/session/   # ChatPanel, SessionSidebar, WorkerTabs
│   ├── components/wizard/    # StepBasics, StepOrchestrator, StepWorkers, StepReview
│   ├── schema.ts             # Drizzle schema (D1)
│   └── auth.ts               # Better-auth config
├── routes/
│   ├── session/new/          # Wizard page
│   ├── session/[id]/         # 3-panel session view
│   ├── dashboard/            # Session list
│   ├── api/session/multi/    # Multi-agent CRUD endpoints
│   └── settings/             # API keys, billing, account
gates/                        # Health checks + production gates
alchemy.run.ts                # Infrastructure config
```

## Current Sprint: Multi-Agent Orchestration

### ✅ Done
- Agent catalog with 7 agent types
- Session creation wizard (4-step: basics → orchestrator → workers → review)
- 3-panel session view (sidebar, chat, worker tabs with iframes)
- D1 schema: `multi_agent_session` + `agent_slot` tables
- Full CRUD API for multi-agent sessions
- Conductor type interface (typed orchestration API)
- Shared components (AgentConfigEditor, status colors)
- All legacy features working (auth, billing, terminals, API keys, production gates)

### 🔄 In Progress
- Container spin-up for agent slots (slot → container mapping)
- Actual agent execution inside containers
- Progress streaming from agents to UI
- Per-minute credit deduction during execution

### ❌ Not Started
- Real conductor implementation (currently types only)
- Inter-agent communication (orchestrator ↔ workers)
- Git repo cloning into containers
- Session pause/resume
- E2E multi-agent test automation

## Footguns

1. **Use `bun`/`bunx`**, not npm/npx
2. **Use Alchemy**, not wrangler — `alchemy.run.ts` is the config
3. **Svelte 5 syntax** — `onclick={fn}` not `on:click={fn}`
4. **ttyd needs size message** — send `{columns:80, rows:24}` on WS connect
5. **Skip `waitForPort`** in production — let WS retry handle ttyd startup
6. **SvelteKit can't proxy WebSocket** — terminal WS goes direct to worker
7. **`noUncheckedIndexedAccess`** — `arr[0]` is `T | undefined`
