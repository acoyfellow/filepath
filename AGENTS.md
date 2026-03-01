# AGENTS.md - filepath

> See [NORTHSTAR.md](./NORTHSTAR.md) for the full plan, protocol spec, schema design, and execution phases.

## North Star

filepath is an **orchestration layer** for AI agents. The core insight: agents and models should be **liquid** (interchangeable), and the infrastructure should provide **multiple interfaces** for coordination.

**Liquid Agents** — Any agent that speaks the filepath protocol (FAP) runs on our infrastructure. Swap Claude Code for Codex for your custom container. Same interface, seamless handoff.

**Liquid Models** — Every agent can use any model. Switch mid-session without restarting. The model is configuration, not architecture.

**Orchestration Interfaces** — However you need to coordinate agents:
- **Dashboard** — Tree + rich chat. Visual hierarchy, human-in-the-loop.
- **REST API** — Programmatic access. Spawn, message, monitor.
- **WebSocket** — Real-time streaming for live applications.
- **MCP + TypeScript SDK** — Agents calling agents. Build autonomous workflows.

## Stack

SvelteKit (Svelte 5) + Cloudflare Workers + Agents SDK (AIChatAgent DOs) + D1 + CF Sandbox + Alchemy + Stripe

## Architecture

```
Browser ←WebSocket→ ChatAgent DO ←stdin/stdout→ Container (CLI agent)
                         ↓
                    D1 (tree state + message history)
```

- **One ChatAgent DO per agent node** — relay/conductor, NOT the agent brain
- **Container runs the actual CLI agent** (claude-code, cursor, codex, shelley, etc.)
- **Agent protocol (FAP):** NDJSON over stdout/stdin. Zod-validated event types.
- **Model routing:** All LLM calls go through filepath API keys → CF AI Gateway → OpenRouter
- **Tree structure:** `agentNode` table with `parentId` (self-referential). Workflowy-inspired.

## Why Liquid Matters

Traditional agent platforms lock you into specific agents or models. filepath treats both as **configuration**:

| Traditional | filepath (Liquid) |
|-------------|-------------------|
| "We support Claude Code" | "Any FAP-compliant agent" |
| "Powered by GPT-4" | "Model is a dropdown. Switch anytime." |
| "Use our web UI" | "Dashboard, API, or SDK — your choice" |

This matters because:
- **Best tool for the job** — Research with Pi, code with Shelley, review with Claude Code, all in one session
- **Future-proof** — New agent drops? Add it to your Dockerfile. New model? Select it in the dropdown.
- **BYO logic** — Your proprietary agent logic runs alongside commercial tools

## Agent Catalog

All agents are equal primitives. The only difference is what's inside the container.

| Agent | CLI | Default Model | Description |
|-------|-----|---------------|-------------|
| Shelley | filepath-native | claude-sonnet-4 | Full-stack engineering. Reference BYO implementation. |
| Pi | filepath-native | claude-sonnet-4 | Research and analysis specialist. |
| Claude Code | `claude` CLI | claude-sonnet-4 | Anthropic's agentic coding tool. |
| Codex | `codex` CLI | o3 | OpenAI's coding agent. |
| Cursor | `cursor` CLI | claude-sonnet-4 | Cursor agent mode via CLI. |
| Amp | `amp` CLI | claude-sonnet-4 | Sourcegraph's large codebase agent. |
| Custom (BYO) | Your Dockerfile | claude-sonnet-4 | Speak FAP, run on filepath. |

### Adding Your Own Agent

Any container that speaks FAP (filepath Agent Protocol) is a first-class agent:

1. Create a Dockerfile with your agent
2. Read `FILEPATH_TASK` env var for the initial task
3. Read NDJSON from stdin for user messages
4. Write NDJSON to stdout for events (text, tools, commands, etc.)
5. Use the OpenRouter API key we inject for LLM calls

See [NORTHSTAR.md](./NORTHSTAR.md) for the full protocol spec.

## CURRENT STATUS (Feb 24, 2026)

**Deploy works. Site live. Core e2e flow working.**

### TRUE NORTH STAR
Screenshot proof of: Login → Create session → Spawn agent → Type message → **Get LLM response in chat**.
The production gate `gates/production/agent-chat.gate.sh` tests this end-to-end.

### What's Working ✅
- Build passes (0 type errors), deploy succeeds
- Auth: login, sign out (visible on all pages), settings pages
- Session: create via dashboard, spawn agent, tree sidebar + chat panel
- Chat: send message → ChatAgent DO → OpenAI → response in chat
- Billing: credit balance displays (10,000 credits), purchase tiers

### Known Bugs 🐛 (fix before calling it done)
1. **OpenRouter API key expired** — routing directly to OpenAI. Get new key.
2. **Dashboard shows 0 agents** for all sessions. Node count query wrong.
3. **Chat history lost between DO restarts** — `chatHistory` is in-memory only.
4. **Production gates fail** — old gates test terminal/billing, new agent-chat gate untested in CI.

### Architecture: Direct LLM Mode
ChatAgent DO calls OpenRouter/OpenAI directly (not via container).
Container execution (Phase 4 original) deferred — direct mode is the demo.

```
Browser ←WebSocket→ ChatAgent DO ←fetch→ OpenRouter/OpenAI
                         ↓
                    D1 (node lookup for model/type)
```

## Development

```bash
bun install
bun run dev          # localhost:5173 (SvelteKit + CF worker via Alchemy)
bash gates/health.sh # Quick health check
bun run deploy       # Deploy via Alchemy (never wrangler)
bun run prd          # Run gates
```

## Rules

1. **`bun`/`bunx`** not npm/npx
2. **Alchemy** not wrangler -- config in `alchemy.run.ts`
3. **Svelte 5** -- `onclick` not `on:click`, runes not stores
4. **Pre-push hook required** -- runs type-check, build, gate validation. Do NOT use `--no-verify`
5. **No explicit `any`** -- use `unknown`, generics, or specific types
6. **Gates before implementation** -- write the test, then write the code
7. **Simplicity always** -- fewer clicks, fewer concepts
8. **Every agent is the same primitive** -- no special-casing orchestrator vs worker in UI
9. **Zod schemas are the source of truth** -- protocol types, not ad-hoc interfaces
10. **Liquid Agents, Liquid Models** — this is the core value prop. Emphasize interchangeability.

## Key Files

```
NORTHSTAR.md                         # The plan. Read this first.
src/lib/protocol/                    # Agent protocol Zod schemas (source of truth)
src/lib/schema.ts                    # Drizzle D1 schema (agentSession + agentNode)
src/agent/chat-agent.ts              # ChatAgent DO (relay, not brain)
src/lib/agents/chat-client.svelte.ts # Svelte 5 WS chat adapter
src/lib/agents/catalog.ts            # Agent definitions
src/lib/components/session/          # Tree, panel, chat, spawn modal
src/lib/components/chat/             # Rich message type components
src/routes/session/[id]/             # Session view (tree + chat)
src/routes/api/session/              # Session + node CRUD
worker/                              # CF Worker entry, agent exports
gates/                               # Health + production gates
```
