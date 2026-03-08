# NORTHSTAR.md

> filepath as it is being built now, not the plan we already outgrew.

## Product Truth

filepath is a chat-first control plane for durable trees of AI agents.

The user flow is simple:
1. Create a session.
2. Spawn an agent by choosing a harness and model.
3. Send work through chat.
4. Watch the agent stream events in a tree-backed session.
5. Reconnect later on another device and continue from the same state.

The product is the combination of:
- a durable session
- a tree of agents
- a chat/event timeline per agent
- isolated execution inside Cloudflare sandboxes

## Core Thesis

Two ideas still define filepath:

- **Liquid agents**: the harness is configuration. Shelley, Codex, Cursor, Claude Code, Amp, or your own container all fit the same shape.
- **Liquid models**: the model is configuration. It is selected per agent, scoped by the routers the account has configured.

Everything else stays thin around those primitives.

## What Is True Today

- **Chat is the only built-in interaction surface.** There is no terminal UI.
- **Every agent is the same primitive.** There is no orchestrator-vs-worker product split in the tree.
- **Each agent gets its own ChatAgent Durable Object.** The DO is a relay and lifecycle manager, not the model brain.
- **Each active agent runs inside its own Cloudflare sandbox.**
- **The tree is persisted in D1.**
- **Message history is persisted in the ChatAgent DO SQLite store.**
- **Dashboard, REST, WebSocket, and MCP all sit on the same core operations.**
- **Auth is Better Auth first.** Browser requests use Better Auth sessions. Agent clients use Better Auth API keys. Dashboard websocket auth is compatible with the same account/session model.
- **Router keys are account-level.** Per-session provider key overrides are removed.
- **Model access is account-scoped.** `/api/models` only returns models from routers the account has configured.
- **Exhausted agents become read-only.** They preserve history and cannot accept further input.
- **No direct LLM fallback exists in the DO.** If the sandbox path fails, filepath fails explicitly.

## Current Architecture

```text
Browser / API client / MCP client
        ↓
SvelteKit + thin route handlers
        ↓
Shared core app operations
        ↓
D1 (sessions, nodes, harness metadata)

Browser
  ↕ WebSocket
ChatAgent Durable Object
  ↕ stdin/stdout
Sandboxed CLI harness
```

The ChatAgent DO is responsible for:
- authenticating websocket clients
- loading and persisting message history
- starting the sandboxed harness on demand
- forwarding user messages to stdin as NDJSON
- parsing harness stdout as structured events
- broadcasting those events back to connected clients
- persisting status transitions like `thinking`, `running`, `done`, `error`, and `exhausted`

The DO is not allowed to silently bypass the harness with a direct model call.

## Shared Contracts

### Agent identity

- `agent_session` is the durable workspace
- `agent_node` is the tree primitive
- `harnessId` is the contract used everywhere live

### Authentication

- browser/app requests: Better Auth session
- agent/API clients: Better Auth API key
- dashboard websocket connection: signed dashboard token tied to the authenticated user and session

### Provider key policy

- provider router keys live on the account
- supported routers are configured centrally in code
- the spawn flow and model catalog are filtered by the routers the account has actually configured

### Runtime protocol

filepath Agent Protocol (FAP) is NDJSON over stdin/stdout.

Container receives:
- `FILEPATH_TASK`
- `FILEPATH_AGENT_ID`
- `FILEPATH_SESSION_ID`
- router API key env vars prepared by the harness adapter
- user messages on stdin as NDJSON

Container emits:
- structured NDJSON events validated by the protocol schema in `src/lib/protocol/`

Core event families:
- `text`
- `tool`
- `command`
- `commit`
- `spawn`
- `workers`
- `status`
- `handoff`
- `done`

## What filepath Is Not

- not a terminal multiplexer
- not a direct-LLM chat app pretending to orchestrate agents
- not a special-case orchestrator UI with worker subtypes
- not a per-session key management product
- not an artifact-first product

If a feature muddies the tree, duplicates chat, or creates a second control surface, it is probably wrong.

## Product Surface

The current primary surface is the dashboard session view:

- left side: tree of agents
- right side: chat/event history for the selected node
- spawn modal: harness + model + name
- account settings: provider router keys

REST and MCP should stay thin and feel like alternate clients of the same system, not parallel product lines.

## Gates and Truth

filepath is validated by gates that describe current behavior, not legacy aspirations.

The current truth emphasis is:
- session creation works
- agent spawn works
- chat reaches a real LLM through the harness/runtime path
- exhausted agents are read-only
- auth boundaries are enforced
- stale terminal/orchestrator claims stay deleted

If the docs claim something the gates do not verify, the docs are suspect.

## Immediate Priorities

The remaining work should keep closing the gap between current code and current story:

1. Finish rewriting docs so they describe the shipped architecture, not the deleted one.
2. Keep collapsing duplicated logic into the shared core and thin clients.
3. Prove the live stack with canonical gate execution against a deployed environment.
4. Continue deleting stale examples and dead compatibility surfaces.

## Design Rules

- Simplicity wins.
- One core, many clients.
- Tree-native always beats flat session hacks.
- The DO is a relay, not the agent brain.
- Prefer explicit failure over hidden fallback.
- Preserve interchangeability of harnesses and models.

## Key Files

- `src/core/app.ts` — shared core operations
- `src/agent/chat-agent.ts` — ChatAgent Durable Object
- `src/lib/protocol/` — protocol schemas
- `src/lib/agents/harnesses.ts` — builtin harness catalog
- `src/routes/session/[id]/+page.svelte` — session UI
- `src/routes/api/` — thin HTTP surfaces over the core
- `worker/agent.ts` and `worker/index.ts` — worker entry and support DOs
- `gates/` — truth checks

## Summary

The direction is still the same:

- one core
- UI is a client
- API is a client
- MCP is a client
- agents are clients

The difference now is that filepath should document only what the repo actually does today.
