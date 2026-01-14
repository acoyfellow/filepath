# AGENTS.md

## Goal
Reliable WebSocket terminal: Browser → Worker → Sandbox (ttyd) → browser.

## Run Tests
```bash
bun run test
bun run typecheck
```

## Build & Dev
```bash
# Terminal 1: Container server (port 8085)
bun run dev:container

# Terminal 2: Worker dev server (port 8788)
bun run dev
```

## Deploy
```bash
bun run deploy
```

## Project Layout
- `worker/index.ts` - Hono routes, WebSocket proxying
- `worker/effects.ts` - Effect-TS error handling
- `container_src/server.js` - Local ttyd server (dev only)
- `alchemy.run.ts` - Infrastructure config
- `scripts/ralph/prd.json` - Story tracking

## Critical Quirks
- Local dev: `LOCAL_DEV=true` in wrangler.dev.json, worker proxies to container server on 8085
- Production: Uses `@cloudflare/sandbox` binding, `getSandbox()` can throw if containers disabled
- ttyd protocol: Send `{columns,rows}` JSON after WebSocket connect to trigger prompt
- Effect errors: Check `_tag` field, use `Effect.runPromise` at boundaries
- Ports: Container 8085, Worker 8788 (must be unique)

## Type Safety
All code TypeScript, no `any`. Use Effect for retries/timeouts.
