# filepath

> Orchestration layer for AI agents. Liquid agents, liquid models, multiple interfaces. BYOK (bring your own key).

filepath is infrastructure for coordinating AI agents. Agents are interchangeable. Models are interchangeable. We provide the orchestration layer — Dashboard for humans, API/MCP/TypeScript for programs.

## The Core Idea

**Liquid Agents** — Swap Claude Code for Codex for Shelley without changing your workflow. Same protocol, seamless handoff.

**Liquid Models** — Switch models mid-session. Start with Claude 4.5, move to GPT-5 for reasoning, switch to Gemini 2.5 for speed.

**Orchestration Infrastructure** — One platform, multiple interfaces:
- **Dashboard** — Visual tree, rich chat, human-in-the-loop
- **REST API** — Spawn agents, send messages, receive events
- **WebSocket** — Real-time streaming for live collaboration
- **MCP + TypeScript** — Agents calling agents programmatically

## Quick Start

1. **Sign up** at https://myfilepath.com
2. **Add your API key** in Settings → Provider API Keys
   - Get an OpenRouter key at https://openrouter.ai/keys
   - Or get an OpenCode Zen key at https://opencode.ai/zen
3. **Create a session** from the dashboard
4. **Spawn an agent** — pick any agent type, pick any model
5. **Send a message** — that's the agent's task
6. **Watch it work** — tool calls, file writes, commits, all in real-time chat

## How It Works

1. Create a session (like a project folder). Optional git repo to clone.
2. Spawn an agent — pick its **type** (Claude Code, Cursor, Codex, Shelley, or BYO), pick its **model** (Claude, GPT, Gemini, 100+ more)
3. The agent works in an isolated container with your repo. Send it messages via chat.
4. Watch through rich chat — tool calls, file writes, commits, all inline
5. Agents spawn child agents. The tree grows. Click any node, see its conversation.
6. Close your laptop, open your phone. Same state, real-time sync.

**BYOK Model:** You bring your own router key. We don't charge for usage — your keys, your spend.

## Stack

SvelteKit (Svelte 5) + Cloudflare Workers + Agents SDK + D1 + CF Sandbox + Alchemy

## The filepath Agent Protocol (FAP)

Agents communicate via NDJSON over stdout/stdin. One JSON object per line, validated with Zod schemas.

This protocol makes agents **liquid** — any agent that speaks FAP runs on filepath, regardless of what's inside the container.

**Container receives:** repo at `/workspace`, task via `FILEPATH_TASK` env var, user messages on stdin.

**Container emits:** structured events to stdout — text, tool calls, commands, commits, spawn requests, status updates, handoffs.

Built-in agents (Shelley, Claude Code, Cursor, Codex, Amp) are reference implementations. BYO = bring a Dockerfile that speaks the protocol.

See [NORTHSTAR.md](./NORTHSTAR.md) for the full protocol spec.

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

- [NORTHSTAR.md](./NORTHSTAR.md) — The plan. Protocol spec, schema, UI components, execution phases.
- [AGENTS.md](./AGENTS.md) — Agent catalog, architecture, development rules.
- [docs/API-REFERENCE.md](./docs/API-REFERENCE.md) — API endpoints
- [llms.txt](./llms.txt) — Context for AI tools

## License

See [LICENSE](./LICENSE).
