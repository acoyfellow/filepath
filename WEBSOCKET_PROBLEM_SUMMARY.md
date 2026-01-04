# WebSocket Terminal Connection Problem - Current State Summary

## Executive Summary

The terminal sharing platform is **stuck at the final step**: WebSocket connections establish successfully, ttyd connects, but **no terminal output appears**. The terminal shows a blinking cursor (xterm.js waiting for data) but never receives the bash prompt from ttyd.

## Current State (As of Latest Attempt)

### What Works ✅

1. **Infrastructure Setup**
   - Sandbox containers build and deploy correctly
   - ttyd process starts successfully (`ttyd -W -p 7681 bash`)
   - Port 7681 becomes ready (confirmed via `waitForPort`)
   - Worker routes correctly (`api.myfilepath.com/*`)

2. **WebSocket Handshakes**
   - Client → Worker WebSocket upgrade: **101 Switching Protocols** ✅
   - Worker → TabBroadcastDO forwarding: **101 response with webSocket** ✅
   - TabBroadcastDO → ttyd connection: **"ttyd connected"** log appears ✅

3. **Message Flow (Partial)**
   - Client sends terminal size on `ws.onopen` ✅
   - TabBroadcastDO receives client messages (when ttyd is ready) ✅
   - TabBroadcastDO sends terminal size to ttyd after connecting ✅

### What Doesn't Work ❌

1. **No Output from ttyd**
   - ttyd connects (readyState: 1, OPEN)
   - Terminal size is sent to ttyd
   - **But ttyd never sends the bash prompt back**
   - Event listener on `ttyd.addEventListener('message')` **never fires**

2. **Terminal Stuck**
   - xterm.js shows blinking cursor (waiting for output)
   - No bash prompt appears
   - User cannot type (no prompt = no input accepted)

3. **No Error Messages**
   - No errors in browser console
   - No errors in Worker logs
   - ttyd doesn't log errors
   - Connection appears healthy but silent

## Architecture Flow

```
Browser (xterm.js)
  ↓ WebSocket: ws://localhost:1337/terminal/:sessionId/:tabId/ws
Worker (Hono)
  ↓ Forward WebSocket upgrade
TabBroadcastDO (Durable Object)
  ↓ Connect via sandbox.wsConnect(wsRequest, 7681)
Sandbox Container
  ↓ ttyd WebSocket on port 7681
ttyd process
  ↓ Should send bash prompt
  ❌ NEVER SENDS OUTPUT
```

## The Critical Race Condition

**The Problem**: Client sends terminal size immediately on `ws.onopen`, but ttyd isn't connected yet (we return 101 immediately, then connect async). The message gets dropped.

**Current "Fix" Attempt**: Send default terminal size (`{columns: 80, rows: 24}`) to ttyd immediately after connecting. This appears in logs ("Sent terminal size to ttyd") but **ttyd still doesn't respond**.

## Code Structure (Current)

### `worker/tab-broadcast.ts` - TabBroadcastDO

**Flow**:
1. `handleWebSocket()` creates `WebSocketPair`, accepts `server`, returns 101 immediately
2. Async: `sendScrollbackToClient()` then `connectTtyd()`
3. `connectTtyd()`:
   - Calls `sandbox.wsConnect(wsRequest, 7681)`
   - Accepts ttyd WebSocket
   - Attaches `addEventListener('message')` for ttyd output
   - **Sends terminal size** (`{columns: 80, rows: 24}`)
   - Logs "ttyd connected"

**Issue**: Event listener is attached, terminal size is sent, but **no messages ever arrive from ttyd**.

### `src/routes/terminal/[id]/tab/+page.svelte` - Frontend

**Flow**:
1. Creates WebSocket on `ws.onopen`
2. Sends terminal size immediately: `JSON.stringify({columns, rows})`
3. Waits in `ws.onmessage` for `CMD_OUTPUT = "0"` messages
4. Writes to xterm.js via `terminal.write()`

**Issue**: `ws.onmessage` never receives data because ttyd never sends it.

## Git History Context

### Working vs Broken Commits

**Problem**: Git history is "muddied" - many commits claim fixes but nothing was ever 100% working. User moved to iFrame approach (one iFrame per tab) to isolate issues, which helped but introduced new race conditions.

**Commit `a08269f`**: Referenced as "working" but may not have been fully functional. Code structure matches this commit exactly now, but problem persists.

**Recent Changes**:
- Switched from hibernation API (`this.ctx.acceptWebSocket`) to standard API (`server.accept()` + `addEventListener`)
- Removed message queue logic
- Added terminal size sending after ttyd connects
- All changes reverted to match `a08269f` structure

### Architecture Evolution

1. **Original**: One terminal with multiple tabs in same tmux session → Problems
2. **iFrame Approach**: One iFrame per tab → Solved isolation, but introduced race conditions
3. **Current**: Each tab = one Sandbox container = one ttyd on port 7681

## The Wake-Up Chain (Complexity)

The full chain is brittle:
1. **Worker** receives `/terminal/:sessionId/:tabId/start`
2. **Worker** calls `sandbox.startProcess('ttyd -W -p 7681 bash')`
3. **Sandbox Container** (Durable Object) starts ttyd
4. **Worker** waits for port 7681 to be ready
5. **Client** connects WebSocket
6. **Worker** forwards to **TabBroadcastDO**
7. **TabBroadcastDO** connects to ttyd via `sandbox.wsConnect()`
8. **TabBroadcastDO** sends terminal size
9. **ttyd** should send bash prompt
10. **TabBroadcastDO** should receive and broadcast to clients
11. **Client** should display in xterm.js

**Current Failure Point**: Step 9-10. ttyd connects but never sends output.

## Hypotheses (Unproven)

1. **Event Listener Timing**: Listener attached after ttyd already sent initial prompt (but we attach before sending terminal size now)
2. **Terminal Size Format**: Maybe ttyd expects different format? (Currently sending plain JSON string)
3. **ttyd Protocol**: Maybe ttyd needs something else to trigger output? (Newline? Different message?)
4. **Sandbox WebSocket Behavior**: Maybe `sandbox.wsConnect()` WebSockets behave differently than standard WebSockets in Durable Objects?
5. **Container State**: Maybe container is in a weird state where ttyd runs but doesn't respond?

## Evidence from Logs

**Latest Logs Show**:
```
[Worker] ttyd ready on port 7681
[Worker] WebSocket upgrade request
[Worker] Forwarding WebSocket to TabBroadcastDO
[Worker] TabBroadcastDO response: 101, hasWebSocket: true
TabBroadcast: ttyd connected for sandbox: ...
TabBroadcast: Sent terminal size to ttyd
```

**What's Missing**:
- No "ttyd message received" logs (event listener never fires)
- No "ttyd disconnected" logs (connection stays open but silent)
- No errors

## Key Files

- `worker/tab-broadcast.ts`: TabBroadcastDO - manages WebSocket connections, connects to ttyd
- `worker/index.ts`: Worker routes, starts ttyd process
- `src/routes/terminal/[id]/tab/+page.svelte`: Frontend terminal UI, WebSocket client
- `alchemy.run.ts`: Infrastructure config (Sandbox, Worker, SvelteKit)

## What Needs to Be Solved

**Core Question**: Why does ttyd connect but never send output?

**Possible Solutions to Investigate**:
1. Check if ttyd actually needs terminal size BEFORE we attach listener
2. Verify ttyd protocol - does it send prompt automatically or need trigger?
3. Test if `sandbox.wsConnect()` WebSockets work differently than expected
4. Add more granular logging to see if ttyd is actually sending (but we're not receiving)
5. Check if there's a timing issue - maybe need to wait after connecting before sending terminal size
6. Verify ttyd process is actually running and healthy (not just port ready)

## Current Code State

The code matches commit `a08269f` structure (minus logging differences). The pattern is:
- Return 101 immediately
- Connect to ttyd asynchronously
- Attach event listeners
- Send terminal size after connecting

This should work, but doesn't. The issue is likely:
- ttyd protocol misunderstanding
- Sandbox WebSocket behavior
- Or a subtle timing/race condition we haven't identified

## Next Steps for New Agent

1. **Verify ttyd protocol**: Research what ttyd actually expects/needs to send output
2. **Test sandbox WebSockets**: Create minimal test to see if `sandbox.wsConnect()` WebSockets work with `addEventListener`
3. **Add granular logging**: Log every step of ttyd connection, message sending, and event listener attachment
4. **Check ttyd process health**: Verify ttyd is actually running and responding (not just port open)
5. **Compare with working examples**: Look at `ironalarm` repo or Cloudflare docs for working patterns

## Critical Insight

The user mentioned: **"We tried at first to have one terminal with multiple tabs, all in the same tmux session that was creating a whole bunch of problems that were eliminated by moving to the iFrame, one iFrame per tab."**

This suggests the architecture has been in flux. The current "one tab = one Sandbox = one ttyd" approach may not have ever been fully working end-to-end, despite commits claiming fixes.

## Reproduction Tests

A `reproduction/` folder was created with test files to isolate the WebSocket event listener issue:
- `test-hibernation.ts`: Tests if hibernation API works with sandbox WebSockets
- `test-standard.ts`: Tests if standard API works with sandbox WebSockets

These tests were created to definitively prove whether the hibernation API (`this.ctx.acceptWebSocket`) works with WebSockets from `sandbox.wsConnect()`, but the tests were never fully executed/debugged.

## Additional Context

- **User frustration**: Multiple hours spent debugging, system feels "brittle"
- **Wake-up process complexity**: Worker → DO → Sandbox → ttyd chain is hard to track
- **Logging confusion**: Extensive logging added but still unclear where failure occurs
- **No definitive working version**: User states "there's always something wrong" and nothing was ever 100% working
- **Device-specific issues**: WebSocket worked on phone (production) but not desktop (dev), suggesting browser/environment differences
