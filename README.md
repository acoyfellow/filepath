# filepath

Open-source agent orchestration platform on Cloudflare.

Tree of agents on the left. Rich chat on the right. Every agent is the same primitive. If your agent has a CLI, it runs on filepath.

## How it works

1. Create a session, optionally point it at a git repo
2. Spawn an agent -- pick its type (claude-code, cursor, codex, or bring your own), pick a model
3. Send it a message. That's its task. It starts working in an isolated container.
4. Watch it work through rich chat -- tool calls, file writes, commits, all inline
5. It can spawn child agents. The tree grows. Click any node, see its conversation.
6. Close your laptop, open your phone. Same state, real-time sync.

## Stack

SvelteKit (Svelte 5) + Cloudflare Workers + Agents SDK + D1 + CF Sandbox + Alchemy

## The filepath Agent Protocol

Agents communicate via NDJSON over stdout/stdin. One JSON object per line, validated with Zod schemas.

**Container receives:** repo at `/workspace`, task via `FILEPATH_TASK` env var, user messages on stdin.

**Container emits:** structured events to stdout -- text, tool calls, commands, commits, spawn requests, status updates, handoffs.

Built-in agents (Shelley, Claude Code, Cursor, Codex, Amp) are reference implementations. BYO = bring a Dockerfile that speaks the protocol.

See [NORTHSTAR.md](./NORTHSTAR.md) for the full protocol spec.

## Development

```bash
bun install
bun run dev          # localhost:5173
bun run deploy       # Alchemy (never wrangler)
bun run prd          # Run gates
```

## Documentation

- [NORTHSTAR.md](./NORTHSTAR.md) -- The plan. Protocol spec, schema, UI components, execution phases.
- [AGENTS.md](./AGENTS.md) -- Agent catalog, architecture, development rules.

## License

See [LICENSE](./LICENSE).
