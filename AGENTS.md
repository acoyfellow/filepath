# AGENTS.md

## North Star

Get **reliable WebSocket terminal connections** working in dev AND prod.

Browser → Worker → Sandbox (ttyd) → terminal output back to browser.

No flakiness. No reconnection hacks. Just works.

## Absolute Rules

1. Only work on tasks in `scripts/ralph/prd.json`
2. Complete exactly ONE story per iteration
3. Tests/verification BEFORE moving on
4. Never commit without passing verification
5. Use version-controlled files as persistent memory
6. Reference Effect patterns from `~/.vendor/effect` when applicable

## Tech Stack

- **Worker:** Cloudflare Workers + Hono + @cloudflare/sandbox
- **Container:** ttyd on port 7681 inside sandbox
- **Frontend:** xterm.js (eventually full SvelteKit from JUNK/)
- **IaC:** Alchemy (`alchemy.run.ts`)
- **Error handling:** Effect-TS for retries, timeouts, typed errors

## Local Dev Workflow

```bash
# Start worker dev server
bun run dev

# In another terminal, start container server (if testing locally)
bun run dev:container

# Deploy
bun run deploy
```

## Key Files

- `worker/index.ts` - Hono routes, WS proxying
- `alchemy.run.ts` - Infrastructure config
- `Dockerfile` - Container image with ttyd
- `JUNK/` - Previous full app (visual/UX reference)
- `JUNK2/` - Previous Effect-TS attempt (patterns reference)

## Verification Checklist

Before marking ANY story complete:

1. [ ] `bun run dev` starts without errors
2. [ ] Can hit `GET /` and get response
3. [ ] Can establish WebSocket at `/terminal/:id/ws`
4. [ ] WebSocket receives data from ttyd
5. [ ] Can type in terminal and see output
6. [ ] No console errors in worker logs
7. [ ] Works in prod after deploy (if applicable)

## Stop Conditions

STOP and ask for help if:
- Container won't start
- WebSocket connects but no data flows
- ttyd process dies unexpectedly
- More than 3 failed attempts at same problem
