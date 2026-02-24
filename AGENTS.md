# AGENTS.md - filepath

> See [NORTHSTAR.md](./NORTHSTAR.md) for the full plan, protocol spec, schema design, and execution phases.

## North Star

filepath is a web UI for orchestrating trees of AI coding agents in containers on Cloudflare. Tree on the left, rich chat on the right. Every agent is the same primitive. If your agent has a CLI, it runs on filepath.

## Stack

SvelteKit (Svelte 5) + Cloudflare Workers + Agents SDK (AIChatAgent DOs) + D1 + CF Sandbox + Alchemy + Stripe

## Architecture

```
Browser ←WebSocket→ ChatAgent DO ←stdin/stdout→ Container (CLI agent)
                         ↓
                    D1 (tree state + message history)
```

- **One ChatAgent DO per agent node** -- relay/conductor, NOT the agent brain
- **Container runs the actual CLI agent** (claude-code, cursor, codex, shelley, etc.)
- **Agent protocol (FAP):** NDJSON over stdout/stdin. Zod-validated event types.
- **Model routing:** All LLM calls go through filepath API keys → CF AI Gateway → OpenRouter
- **Tree structure:** `agentNode` table with `parentId` (self-referential). Workflowy-inspired.

## Agent Catalog

| Agent | CLI | Default Model | Description |
|-------|-----|---------------|-------------|
| Shelley | filepath-native | claude-sonnet-4 | Full-stack engineering. Reference BYO implementation. |
| Pi | filepath-native | claude-sonnet-4 | Research and analysis specialist. |
| Claude Code | `claude` CLI | claude-sonnet-4 | Anthropic's agentic coding tool. |
| Codex | `codex` CLI | o3 | OpenAI's coding agent. |
| Cursor | `cursor` CLI | claude-sonnet-4 | Cursor agent mode via CLI. |
| Amp | `amp` CLI | claude-sonnet-4 | Sourcegraph's large codebase agent. |
| Custom (BYO) | Your Dockerfile | claude-sonnet-4 | Speak the protocol, run on filepath. |

## CURRENT MISSION (Feb 24, 2026): E2E Demo

**Deploy has been broken since Feb 8.** 22 type errors + mailgun.js CF Workers issue.
The live site at myfilepath.com is running stale Feb 8 code. Fix and ship.

### Phase 1: DEPLOY UNBLOCK (do first)
- Fix all type errors (`bunx tsc --noEmit` must pass)
- Fix mailgun.js CF Workers incompatibility (replace with native fetch or stub)
- Successful deploy — verify with `gh run list`

### Phase 2: NAVIGATION & AUTH
- Sign out button visible on dashboard + session views
- Settings pages load (`/settings/account`, `/settings/billing`, `/settings/api-keys`)
- Login → dashboard → settings → sign out flow works

### Phase 3: SESSION CREATION & VIEW
- Session wizard creates a session
- Dashboard lists sessions with working links
- Session view loads (tree + chat panel)

### Phase 4: AGENT EXECUTION
- Start session spins up ChatAgent DOs
- Orchestrator chat: WebSocket connects, LLM responds, messages stream
- Tool execution works, output displays
- Stop session cleanly shuts down

### Phase 5: BILLING BASICS
- Credit balance displays on billing page
- Admin can add test credits for demo
- Session start blocked when credits = 0

### Phase 6: POLISH & DEMO
- Full walkthrough: landing → login → dashboard → create → session → agent → stop → sign out
- No 404s, no console errors on critical paths

**Do phases in order. Commit after every file change. Deploy after Phase 1.**
**Use subagents liberally for parallel work (research in one, implement in another).**

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
4. **Push with `--no-verify`** (pre-push hook is slow)
5. **No explicit `any`** -- use `unknown`, generics, or specific types
6. **Gates before implementation** -- write the test, then write the code
7. **Simplicity always** -- fewer clicks, fewer concepts

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
