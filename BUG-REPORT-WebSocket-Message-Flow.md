# WebSocket Message Flow Bug - Critical Issue Found

## Date
2026-01-08 - Discovered during end-to-end testing

## Location
- File: `worker/index.ts`
- Lines: 370-371 (local dev WebSocket proxy path)

## Bug Description

**Root Cause:** Message forwarding direction was INVERTED in the local dev WebSocket proxy code.

### What Was Wrong (Before Fix)

```typescript
// Lines 370-371 in worker/index.ts
containerWs.addEventListener('message', (event: MessageEvent) => {
  if (server.readyState === WebSocket.OPEN) {
    server.send(event.data);  // ❌ WRONG: Sends FROM container TO client
  }
});

server.addEventListener('message', (event: MessageEvent) => {
  if (containerWs.readyState === WebSocket.OPEN) {
    containerWs.send(event.data);  // ❌ WRONG: Sends FROM client TO container
  }
});
```

### Correct Behavior (After Fix)

```typescript
containerWs.addEventListener('message', (event: MessageEvent) => {
  if (server.readyState === WebSocket.OPEN) {
    server.send(event.data);  // ✅ CORRECT: Sends FROM container (ttyd) TO client (server)
  }
});

server.addEventListener('message', (event: MessageEvent) => {
  if (containerWs.readyState === WebSocket.OPEN) {
    containerWs.send(event.data);  // ✅ CORRECT: Sends FROM client (server) TO container (ttyd)
  }
});
```

### Expected Message Flow

```
Browser Client (xterm.js)
    ↓ WebSocket: ws://localhost:8788/terminal/:id/ws
Worker (Hono)
    ↓ WebSocket: ws://localhost:8085/ws
Container Server
    ↓ WebSocket: ws://localhost:7681/ws
ttyd (terminal emulator)
```

**Correct flow:**
- Client → Worker: User types commands
- Worker → Container: Forward client input to ttyd
- Container → ttyd: ttyd executes commands
- ttyd → Container: Return terminal output
- Container → Worker: Forward ttyd output back to client
- Worker → Client: Display terminal output in browser

### Test Evidence

**Before Fix:**
- WebSocket connection: Opens successfully
- Messages received: `0` (no data flowing)
- Connection closed: Code `1011` (Container WebSocket error)

**After Fix:**
- Still failing: Container server not connecting to ttyd (port 7681)
- Likely issue: `container_src/server.js` spawn or connection logic
- Next investigation needed

## Next Investigation Steps

1. **Debug container_src/server.js**
   - Why does `ws://localhost:7681/ws` connection fail?
   - Check if ttyd process is actually spawned and listening
   - Verify container logs for connection errors

2. **Test ttyd directly**
   - Manual test: `ws://localhost:7681/ws`
   - Confirm ttyd accepts WebSocket connections
   - Verify message protocol

3. **Check container server logic**
   - Line 73: `const ttydWsUrl = 'ws://localhost:7681/ws'`
   - Line 74-82: WebSocket connection and ttyd handshake
   - Look for error handling or timeout issues

## Related Files

- `worker/index.ts` - Main worker with WebSocket proxy (lines 349-388)
- `container_src/server.js` - Local dev container server (lines 1-130)
- `JUNK/worker/index.ts` - Reference implementation for comparison
- `JUNK/worker/tab-broadcast.ts` - JUNK's WebSocket management

## Acceptance Criteria for Full Fix

✅ WebSocket connections remain open (no 1011 errors)
✅ Terminal output flows from ttyd to client
✅ Client input flows to ttyd for execution
✅ User sees interactive bash prompt and can type commands
✅ No connection flakiness

## Fix Status

- [x] Bug identified and documented
- [x] Partial fix applied (message direction corrected)
- [ ] Root cause resolved (container → ttyd connection)
- [ ] End-to-end test passing
- [ ] All PRD stories verified with working tests

## Notes

- This bug would cause terminals to appear completely black (no output)
- Connection opens but immediately closes with no data exchange
- User experience: "I DON'T SEE A TERMINAL LIKE I EXPECT"
- Critical for North Star goal: "reliable WebSocket terminal connections"
