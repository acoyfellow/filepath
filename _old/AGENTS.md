# AGENTS.md

## North Star / Stop Condition
Stop when ALL are true:
- Shareable session URL (password optional) opens a page with N tabs.
- Each tab shows a live terminal (iframe-backed) over WebSocket: Browser → Worker → Sandbox (ttyd) → Browser.
- Works in local dev + prod; `bun run test` + `bun run typecheck` green.

## Absolute Rules
- PRD only (`scripts/ralph/prd.json`)
- One story per loop: implement → verify → commit → repeat
- Tests first; verify before commit
- Memory is files: `prd.json`, `progress.txt`, git commits

## Run Tests
```bash
bun run test
bun run typecheck
```

## Dev / Deploy
```bash
# Terminal 1 (local dev only): container server (port 8085)
bun run dev:container

# Terminal 2: worker dev server (port 8788)
bun run dev

bun run deploy
```

## Layout
- `worker/` - current Worker (Hono) + WebSocket proxying
- `container_src/` - local dev ttyd server (8085)
- `scripts/ralph/prd.json` - tasks
- `scripts/ralph/progress.txt` - learnings

## Critical Quirks
- Local dev: `LOCAL_DEV=true` (wrangler.dev.json) ⇒ proxy to container `http://localhost:8085`
- ttyd: after WS connect, send `{"columns":..,"rows":..}` as **text** to trigger prompt
- WebSocket upgrades: don’t do async auth/middleware before returning 101
- Ports: container 8085, worker 8788
