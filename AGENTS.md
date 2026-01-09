# AGENTS.md

## North Star

Get **reliable WebSocket terminal connections** working in dev AND prod.

Browser → Worker → Sandbox (ttyd) → terminal output back to browser.

No flakiness. No reconnection hacks. Just works.

## Absolute Rules

1. Only work on tasks in `scripts/ralph/prd.json`
2. Complete exactly ONE story per iteration
3. **Type everything** - All code must be properly typed (TypeScript)
4. **Build at every step** - Code must compile/build successfully before moving on
5. **Commit every step** - Commit after each story completion with passing verification
6. **Tests/verification BEFORE moving on** - Never mark a story complete without verification
7. **Small tests on crucial aspects** - Add test harnesses for critical functionality as you go
8. **Never commit without passing verification** - All tests must pass, code must build
9. Use version-controlled files as persistent memory
10. Reference Effect patterns from `/Users/jordan/.vendor/effect` when applicable

## Tech Stack

- **Worker:** Cloudflare Workers + Hono + @cloudflare/sandbox
- **Container:** ttyd on port 7681 inside sandbox
- **Frontend:** xterm.js (eventually full SvelteKit from JUNK/)
- **IaC:** Alchemy (`alchemy.run.ts`)
- **Error handling:** Effect-TS for retries, timeouts, typed errors

## Local Dev Workflow

**CRITICAL: 2-Terminal Setup Required**

You MUST run 2 separate terminal processes for local dev:

```bash
# Terminal 1: Start container server (ttyd WebSocket server)
bun run dev:container

# Terminal 2: Start worker dev server
bun run dev
```

**NEVER try to run both in one terminal/process.** This caused major problems in JUNK/JUNK2.

**Port Assignments (must be unique per project):**
- Container server: 8085 (ttyd WebSocket)
- Worker dev server: 8788

**Testing:**
```bash
# Verify container is running
curl http://localhost:8085/health

# Verify worker is running
curl http://localhost:8788/
```

## Deployment

```bash
bun run deploy
```

## Key Files

- `worker/index.ts` - Hono routes, WS proxying (must be fully typed)
- `alchemy.run.ts` - Infrastructure config
- `Dockerfile` - Container image with ttyd
- `test/` - Test harnesses for critical functionality
- `JUNK/` - Previous full app (visual/UX reference)
- `JUNK2/` - Previous Effect-TS attempt (patterns reference)

## Type Safety Requirements

- All code must be TypeScript with proper types
- No `any` types unless absolutely necessary (with justification)
- Use proper type definitions for Cloudflare Workers APIs
- Type all function parameters and return values
- Use type guards for runtime validation

## Development Workflow

**For EVERY story:**

1. **Type check first**: `bun run typecheck` or `tsc --noEmit` must pass
2. **Build check**: Code must compile/build without errors
3. **Add test harnesses**: Create small tests for critical functionality
   - Example: Test WebSocket connection, test message flow, test error handling
   - Use simple test files or inline verification scripts
4. **Verify manually**: Follow verification checklist below
5. **Commit**: Only after all checks pass, commit with clear message
6. **Update PRD**: Mark story as completed in `scripts/ralph/prd.json`

**Test Harness Examples:**
- `test/websocket.test.ts` - Test WebSocket connections
- `test/container.test.ts` - Test container connectivity
- `scripts/test-*.sh` - Quick verification scripts
- Inline tests in worker code for critical paths

## Verification Checklist

Before marking ANY story complete:

1. [ ] TypeScript compiles: `bun run typecheck` or `tsc --noEmit` passes
2. [ ] Code builds: `bun run build` (if applicable) succeeds
3. [ ] `bun run dev` starts without errors
4. [ ] Can hit `GET /` and get response
5. [ ] Can establish WebSocket at `/terminal/:id/ws`
6. [ ] WebSocket receives data from ttyd
7. [ ] Can type in terminal and see output
8. [ ] No console errors in worker logs
9. [ ] Test harnesses pass (if created)
10. [ ] Works in prod after deploy (if applicable)
11. [ ] **COMMIT** with clear message describing what was completed

## Stop Conditions

STOP and ask for help if:
- Container won't start
- WebSocket connects but no data flows
- ttyd process dies unexpectedly
- More than 3 failed attempts at same problem
