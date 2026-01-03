# Broadcast Proxy for Cross-Browser Terminal Sync

## Problem
Currently, each browser connecting to the same tab URL creates its own ttyd WebSocket connection. ttyd doesn't broadcast output to all connected clients, so typing in one browser doesn't appear in others.

## Solution
Create a **TabBroadcastDO Durable Object** to manage WebSocket connections per tab. This follows the same pattern as `SessionStateDO` which already handles WebSocket broadcasting reliably.

## Architecture

```
Browser 1 ──┐
            ├──> Worker ──> TabBroadcastDO (per tab) ──> Single ttyd connection
Browser 2 ──┘                    (broadcasts to all browsers)
```

**Why Durable Object?**
- Persistent across worker restarts
- Single instance per tab (guaranteed by DO routing)
- Handles multiple worker instances correctly
- Follows existing pattern (SessionStateDO does this)

## Implementation

### 1. Create TabBroadcastDO (`worker/tab-broadcast.ts`)

New Durable Object class that:
- Manages client WebSocket connections (Set<WebSocket>)
- Maintains single ttyd WebSocket connection
- Forwards client → ttyd messages
- Broadcasts ttyd → all clients messages
- Handles cleanup on disconnect

**Pattern:** Follow `SessionStateDO.handleWebSocket()` pattern (lines 169-229 in `session-state.ts`)

### 2. Add TabBroadcast Namespace (`alchemy.run.ts`)

Add new DO namespace:
```typescript
const TabBroadcast = DurableObjectNamespace(`${projectName}-tab-broadcast`, {
  className: "TabBroadcastDO",
  scriptName: `${projectName}-worker`,
});
```

Add to worker bindings.

### 3. Export TabBroadcastDO (`worker/index.ts`)

Export the class so it's available to the worker runtime.

### 4. Modify WebSocket Handler (`worker/index.ts` line ~405)

Instead of direct `sandbox.wsConnect()`, forward to TabBroadcastDO:

```typescript
app.get('/terminal/:sessionId/:tabId/ws', async (c) => {
  // ... validation ...
  const sandboxId = `${sessionId}:${tabId}`;
  const tabBroadcast = getTabBroadcast(c.env, sandboxId);
  
  // Forward WebSocket upgrade to DO
  // DO will handle: client connections, ttyd connection, broadcasting
  return tabBroadcast.fetch(c.req.raw);
});
```

### 5. TabBroadcastDO Implementation

**handleWebSocket method:**
1. Accept client WebSocket connection
2. Add to `clients` Set
3. If no ttyd connection exists:
   - Get sandbox for this tab
   - Create ttyd WebSocket via `sandbox.wsConnect()`
   - Store in `ttyd` property
   - Set up ttyd → all clients broadcasting
4. Set up client → ttyd forwarding
5. Handle cleanup on disconnect

**Key methods:**
- `handleWebSocket(request)` - Main entry point
- `connectTtyd()` - Create/reuse ttyd connection
- `broadcastTtydMessage(data)` - Send ttyd output to all clients
- Cleanup handlers for client/ttyd disconnect

## Files to Create/Modify

1. **Create** `worker/tab-broadcast.ts` - New Durable Object (~150 lines, follows SessionStateDO pattern)
2. **Modify** `alchemy.run.ts` - Add TabBroadcast namespace and binding
3. **Modify** `worker/index.ts` - Export TabBroadcastDO, update WebSocket handler to delegate to DO (~10 lines changed)

## Libraries

No external libraries needed. Cloudflare Workers WebSocket API + Durable Objects provide everything. The pattern is already proven in `SessionStateDO`.

## Benefits

- **Reliable**: DO persists across restarts
- **Scalable**: Single DO instance per tab handles all connections
- **Consistent**: Follows existing SessionStateDO pattern
- **Low LOC**: Reuses proven pattern, ~150 lines new code
- **No dependencies**: Uses built-in Cloudflare APIs

## Testing

After implementation:
1. Open same tab URL in two browsers → should sync
2. Type in browser 1 → appears in browser 2
3. Close one browser → other continues working
4. Worker restart → connections persist (DO state)
5. Multiple tabs → each independent (different DO instances)

