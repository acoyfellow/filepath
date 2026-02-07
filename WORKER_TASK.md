# Worker Task: AIChatAgent Refactor

## Goal
Refactor myfilepath.com to use Cloudflare Agents SDK's `AIChatAgent` as the core agent DO,
replacing the current hollow `TaskAgent` + stub chat flow with SDK-native chat, streaming,
and message persistence.

## Context
- **Current state:** ChatAgent DO + Svelte chat client + session wiring all implemented. Each slot gets its own ChatAgent DO with LLM streaming. Workers have chat/terminal/split view.
- **Target state:** Container integration — LLM tool calls execute in containers, terminal shows container output.
- **Framework:** SvelteKit (Svelte 5), NOT React. SDK client hooks are React-only, so we use a vanilla JS/Svelte adapter.

## Progress
- **Phase 1: ✅ DONE** — ChatAgent DO with AIChatAgent, model mapping, alchemy bindings
- **Phase 2: ✅ DONE** — Svelte 5 runes chat client, ChatPanel wiring
- **Phase 3: ✅ DONE** — Chat clients for ALL slots (orchestrator + workers), WorkerTabs with chat/terminal/split view, auto-send task context on start, server-side chat API for message injection
- **Phase 4: 🔄 NEXT** — Container integration (LLM tool calls → container exec)

## Research Summary (already done)

### AIChatAgent API
- Extends `Agent<Env, State>` → extends `Server` (partyserver)
- Override `onChatMessage(onFinish, options?)` → return a `Response` (streaming or plain)
- `this.messages` auto-populated with full conversation including latest user message
- Messages auto-persisted to DO SQLite (`cf_ai_chat_agent_messages` table)
- Streaming via `createUIMessageStream` + `createUIMessageStreamResponse` from `ai` package
- LLM call via `streamText` from `ai` package with any provider (`@ai-sdk/anthropic`, `@ai-sdk/openai`)
- Framework handles: WS message routing, SSE-over-WS chunking, abort/cancel, resumable streaming

### Client Protocol (for Svelte adapter)
- `AgentClient` from `agents/client` = vanilla JS WebSocket with auto-reconnect, state sync, RPC
- Chat messages are JSON over the same WS:
  - Client → Server: `{type: "cf_agent_use_chat_request", id, init: {method: "POST", headers, body}}`
  - Server → Client: `{type: "cf_agent_use_chat_response", id, body: "<SSE line>", done: false}`
  - Server → Client: `{type: "cf_agent_chat_messages", messages: [...]}`
- The React `useAgentChat` creates a fake `fetch` that returns a `Response` backed by a `ReadableStream` fed from WS messages. ~30 lines of framework-agnostic code.

### What's installed
- `agents` v0.3.10, `ai` v6.0.72, `@ai-sdk/gateway` v3.0.35
- `@cloudflare/ai-chat` v0.0.6 (peer dep of agents)
- **NOT installed:** `@ai-sdk/anthropic`, `@ai-sdk/openai` — NEED TO ADD

## Implementation Plan

### Phase 1: Install deps + create ChatAgent DO
1. `bun add @ai-sdk/anthropic @ai-sdk/openai`
2. Create `src/agent/chat-agent.ts` — extends `AIChatAgent`
   - `onChatMessage` calls `streamText` with Anthropic provider
   - System prompt from agent slot config
   - Model from agent slot config (maps ModelId → AI SDK model)
3. Update `alchemy.run.ts` to register the new DO class with `new_sqlite_classes`
4. Keep `TaskAgent` for now (don't break existing stuff)

### Phase 2: Svelte chat client
1. Create `src/lib/agents/chat-client.ts` — Svelte 5 runes-based chat adapter
   - Uses `AgentClient` from `agents/client` for WS connection
   - Implements the chat protocol (send/receive/stream) by listening for `cf_agent_*` messages
   - Exposes reactive `messages` state, `sendMessage()`, `isStreaming`, `cancel()`
   - Reconstructs SSE stream from WS chunks → feeds to AI SDK stream parser OR parses manually
2. Update `ChatPanel.svelte` to use the new client instead of REST stub

### Phase 3: Wire session → agent DOs
1. When session starts, create/connect to a ChatAgent DO per agent slot
   - DO name = `chat-{slotId}` or similar unique identifier
   - Pass agent config (model, system prompt, env vars) as DO state
2. Update `/api/session/multi/chat` to route to the right DO (or remove — client talks to DO directly via WS)
3. Update `WorkerTabs` to show agent output

### Phase 4: Container integration
1. ChatAgent DO manages its own sandbox container
2. LLM tool calls can execute commands in the container
3. Terminal iframe shows the container, chat shows the conversation

## Key Decisions
- **One ChatAgent DO per agent slot** (not per session) — each worker gets its own conversation
- **Client connects directly to DO via WebSocket** — no REST proxy needed for chat
- **Anthropic as default provider** — matches the catalog defaults (claude-sonnet-4)
- **Keep D1 for session metadata** — DO SQLite for chat messages only

## Files to Create/Modify
- CREATE: `src/agent/chat-agent.ts`
- CREATE: `src/lib/agents/chat-client.ts`
- MODIFY: `alchemy.run.ts` (register DO)
- MODIFY: `src/lib/components/session/ChatPanel.svelte`
- MODIFY: `src/routes/session/[id]/+page.svelte`
- MODIFY: `package.json` (add deps)
- MAYBE MODIFY: `worker/agent.ts` (routing)

## Build Gate
**DO NOT run `bunx tsc --noEmit` — it takes 10 minutes on this VM** (Stripe 156K + CF workers 104K lines of .d.ts).
CI will catch type errors. Just commit and iterate fast.
Run `bash gates/health.sh` between phases (it skips tsc).
If you need a quick syntax sanity check, use `bun run check 2>&1 | head -20` or just read the error from `bun run dev` output.

## DO NOT
- Don't delete TaskAgent yet — it has other @callable methods we may still need
- Don't use React hooks — we're Svelte
- Don't use wrangler — Alchemy only
- Don't use npm/npx — bun/bunx only
- Don't break the existing start flow (container spin-up)
