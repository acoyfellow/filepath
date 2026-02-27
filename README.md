# filepath

> Agent orchestration platform on Cloudflare. Tree of agents on the left, rich chat on the right. BYOK (bring your own key).

## Quick Start

1. **Sign up** at https://myfilepath.com
2. **Add your API key** in Settings → Provider API Keys
   - Get an OpenRouter key at https://openrouter.ai/keys
   - Or use OpenAI, Anthropic, or any OpenAI-compatible provider
3. **Create a session** from the dashboard
4. **Spawn an agent** - pick type (claude-code, codex, cursor) and model
5. **Send a message** - that's the agent's task
6. **Watch it work** - tool calls, file writes, commits, all in real-time chat

## How it works

1. Create a session, optionally point it at a git repo
2. Spawn an agent -- pick its type (claude-code, cursor, codex, or bring your own), pick a model
3. Send it a message. That's its task. It starts working in an isolated container.
4. Watch it work through rich chat -- tool calls, file writes, commits, all inline
5. It can spawn child agents. The tree grows. Click any node, see its conversation.
6. Close your laptop, open your phone. Same state, real-time sync.

**BYOK Model:** You bring your own LLM API keys. We don't charge for usage - your keys, your spend.

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
- [docs/API-REFERENCE.md](./docs/API-REFERENCE.md) -- API endpoints
- [llms.txt](./llms.txt) -- Context for AI tools

## License

See [LICENSE](./LICENSE).
