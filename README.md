# myfilepath.com

Multi-agent orchestration platform. Users configure sessions with an orchestrator + workers from an agent catalog, give them a task and a git repo, and watch them work in parallel in isolated containers.

## Architecture

```
User → Wizard → Multi-Agent Session → Agent Slots → ChatAgent DOs → Containers
                     ↓                     ↓              ↓              ↓
               D1 metadata          Config/Status   LLM + Chat      Execution
                                    Model/Router    (AIChatAgent)   (ttyd+bash)
```

**Stack:** Cloudflare Workers, Agents SDK (AIChatAgent), SvelteKit (Svelte 5), D1, Alchemy, Stripe

### How It Works

1. **Session wizard** (`/session/new`) — pick orchestrator + workers from catalog, configure models/prompts
2. **Start session** — containers spin up per agent slot, git repo cloned
3. **Chat flows over WebSocket** directly to ChatAgent DOs (one per slot)
4. **LLM streaming** via AI SDK v6 — SSE-over-WS with resumable connections
5. **Tool calling** — `execute_command` runs shell commands in the agent's container
6. **Conductor** — orchestrator can `delegate_task`, `list_workers`, `read_worker_messages`
7. **Credits** — per-call + per-minute deduction, auto-stop on depletion

### Agent Catalog

| Agent | Roles | Default Model |
|-------|-------|---------------|
| Shelley 🐚 | orchestrator, worker | claude-sonnet-4 |
| Pi 🥧 | orchestrator, worker | claude-sonnet-4 |
| Claude Code 🤖 | orchestrator, worker | claude-sonnet-4 |
| OpenCode 📖 | worker | claude-sonnet-4 |
| Codex 📜 | worker | o3 |
| Amp ⚡ | worker | claude-sonnet-4 |
| Custom 🔧 | orchestrator, worker | claude-sonnet-4 |

### Model Routing

All models route through two providers — no Anthropic key needed:
- **OpenAI models** (gpt-4o, o3) → Cloudflare AI Gateway → OpenAI
- **Anthropic models** (claude-sonnet-4, opus) → OpenRouter
- **DeepSeek, Gemini** → OpenRouter

## Development

```bash
bun install
bun run dev          # localhost:5173 (SvelteKit + CF worker via Alchemy)
bash gates/health.sh # Quick health check (skips tsc — too slow on dev VM)
bun run deploy       # Deploy via Alchemy (never wrangler)
```

> **Note:** `bunx tsc --noEmit` takes ~10 min due to heavy type deps (Stripe 156K + CF workers 104K lines of .d.ts). CI catches type errors. Don't run in loops.

## Key Files

```
src/
├── agent/
│   ├── chat-agent.ts              # AIChatAgent DO — LLM conversations + tools
│   ├── index.ts                   # TaskAgent DO (legacy, workflows)
│   └── workflows/                 # ExecuteTask, CreateSession
├── lib/
│   ├── agents/
│   │   ├── catalog.ts             # 7 agent types
│   │   └── chat-client.svelte.ts  # Svelte 5 WS chat adapter
│   ├── types/session.ts           # AgentSlot, MultiAgentSession, ModelId
│   ├── types/conductor.ts         # Conductor interface
│   ├── components/session/        # ChatPanel, SessionSidebar, WorkerTabs
│   ├── components/wizard/         # 4-step session creation
│   ├── schema.ts                  # Drizzle D1 schema
│   └── auth.ts                    # Better-auth config
├── routes/
│   ├── session/new/               # Wizard page
│   ├── session/[id]/              # 3-panel session view
│   ├── dashboard/                 # Session list
│   ├── api/session/multi/         # CRUD + start/stop/chat/status
│   └── settings/                  # API keys, billing, account
worker/
├── agent.ts                       # Exports ChatAgent, TaskAgent, workflows
└── index.ts                       # Terminal handlers, /start-agent-slots
gates/                             # Health + production gates
alchemy.run.ts                     # Infrastructure config
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/session/multi` | POST/GET | Create / get session |
| `/api/session/multi/list` | GET | List user's sessions |
| `/api/session/multi/start` | POST | Start session (spin up containers) |
| `/api/session/multi/stop` | POST | Stop session |
| `/api/session/multi/chat` | POST | Server-side message injection |
| `/api/session/multi/status` | GET | Poll session + slot statuses |
| `/api/billing/checkout` | POST | Stripe checkout |
| `/api/billing/balance` | GET | Credit balance |

Primary chat goes over **WebSocket** directly to ChatAgent DOs, not through REST.

## Rules

- **`bun`/`bunx`** not npm/npx
- **Alchemy** not wrangler — `bun run deploy`, config in `alchemy.run.ts`
- **Svelte 5** — `onclick={fn}` not `on:click={fn}`
- **AIChatAgent is the core** — one DO per agent slot, WS for chat
- **Push with `--no-verify`** — pre-push hook runs svelte-check (slow)
