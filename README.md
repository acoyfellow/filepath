# myfilepath.com

The platform for agents.

## Stack

- **SvelteKit** - Frontend framework
- **Better Auth** - Human authentication (email/password, OAuth)
- **Durable Objects** - Session state persistence
- **Cloudflare Containers** - Terminal sandboxes
- **D1** - Database for auth + metadata
- **Alchemy** - Infrastructure as code

## Development

```bash
bun install
bun run dev        # localhost:5173
```

## Deploy

```bash
# Production (myfilepath.com)
bun run deploy

# Preview
bun run deploy:preview
```

## Architecture

```
Human/Agent → SvelteKit → Durable Object (Session)
                              ↓
                        Container (Sandbox)
                           ttyd + opencode
```

- **Session DO**: Manages tabs, state, WebSocket broadcasts
- **Container**: Isolated terminal environment per tab
- **Better Auth**: Human identity (agents use API keys - coming soon)

## Checkpoint 1: Terminal Parity

- [x] SvelteKit + better-auth base
- [x] Session management via Durable Objects
- [x] Terminal tabs UI
- [x] Container/sandbox integration
- [ ] Terminal WebSocket proxy
- [ ] Deploy to myfilepath.com
- [ ] Tests/gates
