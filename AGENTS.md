# AGENTS.md - myfilepath.com

## North Star

Users configure sessions with an orchestrator + workers from an agent catalog, give them a task and a git repo, and watch them work in parallel in isolated containers.

This is NOT a chatbot. The product is autonomous agents collaborating on real code.

## Stack

Cloudflare Workers + Agents SDK (AIChatAgent) + SvelteKit (Svelte 5) + D1 + Alchemy

## Architecture

```
User → Wizard → Session → Agent Slots → ChatAgent DOs → Containers
                   ↓            ↓              ↓              ↓
              D1 metadata   Config/Status   LLM + Chat    Execution
                                            (AIChatAgent) (ttyd+bash)
```

- **One ChatAgent DO per agent slot** — SDK-native chat persistence (DO SQLite), streaming (SSE-over-WS), resumable
- **Client connects via WebSocket directly to DO** — no REST proxy for chat
- **Model routing:** OpenAI models → CF AI Gateway. Anthropic/DeepSeek/Gemini → OpenRouter. No Anthropic key needed.
- **Tools:** `execute_command` (shell in container), `delegate_task`, `list_workers`, `read_worker_messages` (conductor)

## Status (Feb 7, 2026)

✅ Auth, billing, agent catalog, wizard, 3-panel session view, container start/stop,
ChatAgent DOs, Svelte chat client, tool calling, conductor tools, git cloning,
credit deduction (per-call + per-minute), status polling, session delete, model routing

❌ E2E prod test, session pause/resume, typed API contracts

## Development

```bash
bun install
bun run dev          # localhost:5173
bash gates/health.sh # Quick check (skips tsc)
bun run deploy       # Alchemy (never wrangler)
```

> `bunx tsc --noEmit` takes ~10 min on this VM. CI catches type errors. Don't run in loops.

## Rules

1. **`bun`/`bunx`** not npm/npx
2. **Alchemy** not wrangler — config in `alchemy.run.ts`
3. **Svelte 5** — `onclick` not `on:click`
4. **Push with `--no-verify`** (pre-push hook is slow)
5. **No explicit `any`** — use `unknown`, generics, or specific types
6. Commit after every file change. Descriptive messages.

## Key Files

```
src/agent/chat-agent.ts              # AIChatAgent DO (core)
src/lib/agents/chat-client.svelte.ts # Svelte 5 WS chat adapter
src/lib/agents/catalog.ts            # 7 agent types
src/lib/types/session.ts             # AgentSlot, MultiAgentSession, ModelId
src/lib/components/session/          # ChatPanel, SessionSidebar, WorkerTabs
src/lib/components/wizard/           # 4-step session creation
src/routes/api/session/multi/        # CRUD + start/stop/chat/status
worker/agent.ts                      # Exports ChatAgent, TaskAgent, workflows
worker/index.ts                      # Terminal handlers, container management
alchemy.run.ts                       # Infrastructure config
```
