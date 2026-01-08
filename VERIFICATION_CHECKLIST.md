# Verification Checklist - Before Proceeding

## Critical Questions We Must Answer First

### 1. Container URL Format ✅/❌
**Question**: What is the correct URL format for Alchemy Container bindings?

**Current assumption**: `http://container:7681/ws`
**Need to verify**:
- Does Alchemy use `container` as hostname?
- Should it be `localhost`? `127.0.0.1`? Something else?
- Does the container binding handle hostname resolution automatically?

**Test**: `/test/container` endpoint to verify basic HTTP connectivity

### 2. ttyd Protocol ✅/❌
**Question**: What does ttyd actually expect/need?

**Current assumption**: Send JSON `{columns: 80, rows: 24}` after connecting
**Need to verify**:
- Does ttyd send prompt automatically on connect?
- Does ttyd need terminal size BEFORE connecting?
- What message format does ttyd expect? (JSON? Binary? Text?)
- Does ttyd need any initialization messages?

**Research needed**: ttyd documentation, protocol spec

### 3. Container WebSocket Support ✅/❌
**Question**: Do Alchemy Containers support WebSocket upgrades via `fetch()`?

**Current assumption**: Yes, like Cloudflare Workers
**Need to verify**:
- Does `container.fetch()` with `Upgrade: websocket` header work?
- Does it return `response.webSocket` like Workers?
- Are there any differences in behavior?

**Test**: Try WebSocket connection and log response details

### 4. ttyd Process State ✅/❌
**Question**: Is ttyd actually running and ready?

**Current assumption**: Yes, because Dockerfile CMD starts it
**Need to verify**:
- Is ttyd process running inside container?
- Is port 7681 actually listening?
- Is ttyd healthy and ready to accept connections?

**Test**: Add health check endpoint or process check

## What We're NOT Doing (Avoiding JUNK Mistakes)

❌ **NOT** assuming WebSocket connection works without verification
❌ **NOT** sending terminal size without understanding ttyd protocol
❌ **NOT** attaching event listeners without confirming connection
❌ **NOT** proceeding with complex architecture before basics work
❌ **NOT** making assumptions about container URL format

## Verification Steps (In Order)

1. **Test basic container HTTP connectivity**
   - Endpoint: `GET /test/container`
   - Verify: Can we reach container at all?
   - Expected: Some response (even 404 is fine, means container is reachable)

2. **Test container WebSocket upgrade**
   - Endpoint: `GET /test/container/ws`
   - Verify: Does `container.fetch()` with WebSocket headers return 101?
   - Expected: `response.status === 101 && response.webSocket`

3. **Test ttyd WebSocket connection**
   - Endpoint: `GET /test/ttyd/ws`
   - Verify: Can we connect to ttyd WebSocket?
   - Expected: Connection established, WebSocket object returned

4. **Test ttyd message reception**
   - After step 3, wait for messages
   - Verify: Does ttyd send ANY messages after connection?
   - Expected: Some data (even if not prompt)

5. **Test ttyd protocol**
   - Send terminal size in different formats
   - Verify: What format does ttyd accept?
   - Expected: Understanding of correct protocol

## Current Status

- ✅ Frontend loads (xterm.js CDN works)
- ✅ Client WebSocket connects (101 status)
- ❓ Container URL format: **UNKNOWN**
- ❓ Container WebSocket support: **UNKNOWN**
- ❓ ttyd protocol: **UNKNOWN**
- ❓ ttyd process state: **UNKNOWN**

## Next Steps

1. Add `/test/container` endpoint (DONE)
2. Test it and verify container URL format
3. Add `/test/container/ws` endpoint
4. Test WebSocket upgrade
5. Only then proceed with full terminal connection

