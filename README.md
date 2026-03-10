# filepath

> Durable agent sessions, organized as trees, running through a session-root ChatAgent and Cloudflare sandboxes.

filepath is a chat-first orchestration layer for AI agents. The main product surface is:

- a durable session
- a tree of agent nodes
- a chat and event timeline per node
- isolated execution in Cloudflare sandboxes

The system stays thin around the real primitives: harness, model, sandbox, and router keys.

## What Is True Today

- Each session uses one root ChatAgent route for browser chat connections.
- The selected node is bound in the websocket init message, not in the URL.
- Each active node execution runs in its own sandbox workspace and process context.
- Sessions, nodes, and tree structure persist in D1.
- Chat history persists and reconnects cleanly across devices on the same account.
- Chat is the only built-in control surface.
- Provider router keys are account-level.
- `/api/models` only returns models from routers the account has configured.
- Exhausted agents become read-only instead of silently continuing.

## Core Model

- **Session**: the durable workspace
- **Agent node**: one harness + one model inside the tree
- **Chat/event history**: the runtime timeline for that node

Every node is the same primitive. There is no special orchestrator node type in the product surface.

## Quick Start

1. Sign up at [myfilepath.com](https://myfilepath.com).
2. Add a router key in Settings → Provider Router Keys.
3. Create a session.
4. Spawn an agent by choosing a harness and model.
5. Send work through chat.
6. Watch the agent stream status, tool calls, commands, commits, and handoffs into the session.

## Runtime Shape

```text
Browser / API / MCP client
        ↓
thin SvelteKit routes
        ↓
shared core app operations
        ↓
D1

Browser
  ↕ WebSocket
session-root ChatAgent
  ↕ node init + message dispatch
selected node runtime
  ↕ sandbox exec
Sandboxed CLI harness
```

The ChatAgent is a relay and lifecycle manager for the session-root websocket path. It does not silently fall back to a direct LLM call when the sandbox path fails.

## filepath Agent Protocol

Harnesses speak NDJSON over stdin/stdout.

Container receives:
- `FILEPATH_TASK`
- `FILEPATH_AGENT_ID`
- `FILEPATH_SESSION_ID`
- router credentials via adapter-prepared env vars
- user messages over stdin

Container emits:
- structured NDJSON events validated by the protocol schema in `src/lib/protocol/`

Built-in harnesses are reference implementations. BYO means shipping a container that speaks the same protocol.

## Development

```bash
bun install
bun run dev
bash gates/health.sh
bun run deploy
```

## Docs

- [NORTHSTAR.md](./NORTHSTAR.md) — current product truth and direction
- [AGENTS.md](./AGENTS.md) — repo rules and architecture notes for coding agents
- [docs/README.md](./docs/README.md) — surviving repo markdown docs
- [static/llms.txt](./static/llms.txt) — compact repo context for AI tools

## License

See [LICENSE](./LICENSE).
