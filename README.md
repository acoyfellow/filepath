# filepath

> Long-running sessions made of durable agents, backed by Cloudflare sandboxes.

filepath is the orchestration layer that stays thin around the real primitives: Cloudflare sandboxes, your chosen harness, your chosen model, and your own router keys. The product surface is:
- a durable session
- a tree of agents that organizes work like a filesystem
- a chat-first control surface
- explicit agent state and event history

## What Is True Today

- Each agent runs inside its own Cloudflare sandbox with its own filesystem and process space.
- Sessions reconnect cleanly to the same tree and history.
- Session state streams live across your own devices on the same account.
- Threads can hand files to each other explicitly.
- Threads can be moved and regrouped like files and folders.

## Quick Start

1. **Sign up** at https://myfilepath.com
2. **Add your router key** in Settings → Provider Router Keys
   - Get an OpenRouter key at https://openrouter.ai/keys
   - Or get an OpenCode Zen key at https://opencode.ai/zen
3. **Create a session** from the dashboard
4. **Spawn an agent** — choose from the supported harnesses and use the exact model string from your router
5. **Send a message** — chat is the agent's control surface
6. **Watch it work** — tool calls, file writes, commits, and explicit handoffs show up in the session

## How It Works

1. Create a session (like a project folder). Optional git repo to clone.
2. Spawn an agent — choose a supported harness and the exact model string your router exposes
3. The agent runs in its own sandboxed runtime. Send it work through chat.
4. Agents can spawn child agents and be reorganized while the work stays live.
5. Reopen the session on another device on the same account and keep going.

**BYOK Model:** You bring your own router key. We don't charge for usage — your keys, your spend.

## Stack

SvelteKit (Svelte 5) + Cloudflare Workers + Agents SDK + D1 + CF Sandbox + Alchemy

## Thread Model

- **Session**: the durable workspace
- **Agent**: one harness + model lane inside the tree
- **Event stream**: the durable chat and runtime history for an agent

Chat is the only built-in surface. The runtime stays headless.

## The filepath Agent Protocol (FAP)

Agents communicate via NDJSON over stdout/stdin. One JSON object per line, validated with Zod schemas.

This protocol keeps filepath thin — the harness can vary, but the orchestration surface stays consistent.

**Container receives:** repo at `/workspace`, task via `FILEPATH_TASK` env var, user messages on stdin.

**Container emits:** structured events to stdout — text, tool calls, commands, commits, spawn requests, status updates, handoffs.

Built-in agents (Shelley, Claude Code, Cursor, Codex, Amp) are reference implementations. BYO = bring a Dockerfile that speaks the protocol.

See [NORTHSTAR.md](./NORTHSTAR.md) for the protocol and long-range direction.

## Development

```bash
bun install
bun run dev          # localhost:5173
bun run deploy       # Alchemy (never wrangler)
bun run prd          # Run gates
```

## Agent Memory (Deja)

This project uses [deja](https://deja.coey.dev) for persistent memory across agent sessions.

Set `DEJA_API_KEY` in your `.env` (ask project owner for the key).

```bash
# Query memories at session start
curl -s -X POST https://deja.coey.dev/inject \
  -H "Authorization: Bearer $DEJA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"context": "filepath current status", "format": "prompt", "limit": 7}'

# Store learnings after milestones
curl -s -X POST https://deja.coey.dev/learn \
  -H "Authorization: Bearer $DEJA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"trigger": "when to surface", "learning": "what was learned", "confidence": 0.9}'
```

## Documentation

- [NORTHSTAR.md](./NORTHSTAR.md) — protocol and long-range direction
- [AGENTS.md](./AGENTS.md) — agent catalog, architecture, development rules
- [docs/API-REFERENCE.md](./docs/API-REFERENCE.md) — API endpoints
- [llms.txt](./llms.txt) — context for AI tools

## License

See [LICENSE](./LICENSE).
