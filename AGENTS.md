# AGENTS.md - myfilepath.com

Agent instructions for the myfilepath.com codebase.

## North Star

**Users configure sessions with an orchestrator + workers from an agent catalog, give them a task and a git repo, and watch them work in parallel in isolated containers.**

This is NOT a chatbot. The product is autonomous agents collaborating on real code in real containers.

## Stack

Cloudflare Workers + Agents SDK (AIChatAgent) + SvelteKit (Svelte 5) + D1 + Alchemy

## Current Status (Feb 7, 2026)

✅ **Working:**
- SvelteKit UI: landing, auth, dashboard, wizard, session view, settings
- Better-auth (email/password, API keys)
- Stripe billing (checkout, webhooks, credits)
- Agent catalog (7 types: shelley, pi, claude-code, opencode, codex, amp, custom)
- Multi-agent DB schema (`multi_agent_session` + `agent_slot` tables)
- Multi-agent CRUD API (`/api/session/multi/*` — create, get, list, start, stop, chat)
- Session wizard (4-step: basics → orchestrator → workers → review)
- 3-panel session view (sidebar, chat, worker tabs)
- Container start flow (Start button → assign containerIds → worker → getSandbox + startProcess)
- Agent terminal endpoint (`/agent-terminal/{containerId}` with xterm.js + ttyd)
- **ChatAgent DO** — `AIChatAgent` subclass with Anthropic/OpenAI providers, model mapping
- **Svelte 5 chat client** — runes-based WS adapter for AIChatAgent protocol (432 lines)
- **ChatPanel + WorkerTabs** wired to ChatAgent DOs via WebSocket
- **Per-slot chat clients** — orchestrator + every worker gets own ChatAgent DO
- **WorkerTabs** — chat/terminal/split view mode toggle per worker
- **Container tool use** — `execute_command` tool via getSandbox for LLM shell access
- **Server-side chat API** — `/api/session/multi/chat` routes messages to ChatAgent DOs
- **Auto task context** — session name/description/repo sent to orchestrator on start
- Production gates in CI

🔄 **In Progress:**
- E2E testing: create session → start → chat → LLM response → tool use
- Per-minute credit deduction during container runtime

✅ **Recently completed:**
- All LLM calls route through OpenRouter (single OPENROUTER_API_KEY for all models)
- Credit deduction per LLM call (atomic D1 update in ChatAgent DO)
- Race condition fix: WS connection awaited before auto-sending task context
- Production gates relaxed for pre-existing terminal/DO issues

❌ **Not Started:**
- Conductor runtime (orchestrator auto-delegates tasks to workers)
- Git repo cloning into containers
- Status polling / real-time slot status updates
- Session pause/resume

## Architecture

```
User → Wizard → Multi-Agent Session → Agent Slots → ChatAgent DOs → Containers
                     ↓                     ↓              ↓              ↓
               D1 metadata          Config/Status   LLM + Chat      Execution
                                    Model/Router    (AIChatAgent)   (ttyd+bash)
```

**One ChatAgent DO per agent slot.** Each has:
- SDK-native chat persistence (DO SQLite)
- Streaming via SSE-over-WebSocket (resumable)
- LLM calls via AI SDK v6 (`streamText` + `@ai-sdk/anthropic`)
- State: slotId, sessionId, agentType, model, systemPrompt, containerId

**Client connects to DO directly via WebSocket** — no REST proxy for chat.

### Core Components

| Component | File | Purpose |
|-----------|------|---------|  
| ChatAgent | `src/agent/chat-agent.ts` | AIChatAgent DO — real LLM conversations |
| Chat Client | `src/lib/agents/chat-client.svelte.ts` | Svelte 5 WS adapter for AIChatAgent |
| TaskAgent | `src/agent/index.ts` | Legacy DO (RPC+REST, workflows) |
| Agent Catalog | `src/lib/agents/catalog.ts` | Registry of 7 agent types |
| Session Types | `src/lib/types/session.ts` | AgentSlot, MultiAgentSession, ModelId |
| Conductor | `src/lib/types/conductor.ts` | Orchestration interface (types only) |
| Wizard | `src/lib/components/wizard/` | 4-step session creation |
| Session View | `src/lib/components/session/` | ChatPanel, SessionSidebar, WorkerTabs |

## Development

```bash
bun install
bun run dev          # localhost:5173
bash gates/health.sh # Health check (fast — skips tsc)
bun run deploy       # Deploy via Alchemy
```

**⚠️ tsc takes ~10 min on this VM** (Stripe=156K + CF workers=104K lines of .d.ts on 2 CPUs).
Do NOT run `bunx tsc --noEmit` in loops. CI catches type errors. Run manually only when needed.

## Code Rules

### Svelte 5 Syntax (CRITICAL)
```svelte
<!-- ❌ WRONG --><button on:click={fn}>   <!-- ✅ RIGHT --><button onclick={fn}>
```

### TypeScript
- No explicit `any` — use `unknown`, generics, or specific types
- `arr[0]` is `T | undefined` (noUncheckedIndexedAccess)

### Commit Discipline
1. **DO NOT run `bunx tsc --noEmit`** in loops
2. Commit after EVERY file change
3. Push with `--no-verify` (pre-push hook runs svelte-check, also slow)
4. Run `bash gates/health.sh` between phases

## Key Files

```
src/
├── agent/
│   ├── chat-agent.ts            # AIChatAgent DO (LLM conversations)
│   ├── index.ts                 # TaskAgent DO (legacy, workflows)
│   └── workflows/               # ExecuteTask, CreateSession
├── lib/
│   ├── agents/
│   │   ├── catalog.ts           # 7 agent types
│   │   └── chat-client.svelte.ts # Svelte 5 WS chat adapter
│   ├── types/session.ts         # AgentSlot, MultiAgentSession, ModelId
│   ├── types/conductor.ts       # Conductor interface (types only)
│   ├── components/session/      # ChatPanel, SessionSidebar, WorkerTabs
│   ├── components/wizard/       # StepBasics, StepOrchestrator, StepWorkers, StepReview
│   ├── schema.ts                # Drizzle D1 schema
│   └── auth.ts                  # Better-auth config
├── routes/
│   ├── session/new/             # Wizard page
│   ├── session/[id]/            # 3-panel session view
│   ├── dashboard/               # Session list
│   ├── api/session/multi/       # CRUD + start/stop/chat endpoints
│   └── settings/                # API keys, billing, account
worker/
├── agent.ts                     # Worker entry — exports ChatAgent, TaskAgent
└── index.ts                     # Terminal handlers, /start-agent-slots, /agent-terminal/*
gates/                           # Health + production gates
alchemy.run.ts                   # Infrastructure config (NOT wrangler)
```

## ⚠️ CRITICAL Rules

1. **Alchemy, NOT Wrangler** — `bun run deploy`, config in `alchemy.run.ts`
2. **`bun`/`bunx`** not npm/npx
3. **Svelte 5** — `onclick` not `on:click`
4. **`--no-verify`** on git push (pre-push hook is slow)
5. **AIChatAgent is the core** — don't build REST chat endpoints, use WS protocol
6. **One ChatAgent DO per agent slot** — not per session

## Sprint Priorities

1. ✅ ChatAgent DO + Svelte chat client + UI wiring
2. 🔄 Session start creates ChatAgent DOs, full e2e chat flow works
3. Container integration (ChatAgent manages its sandbox, LLM tool calls exec in container)
4. Real credit deduction (atomic D1 update, per-minute billing loop)
5. Conductor runtime (orchestrator drives workers, inter-agent communication)
6. Git repo cloning into containers
7. Status polling / real-time session updates
