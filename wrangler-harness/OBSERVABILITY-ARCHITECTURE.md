# Observability Architecture

## Current: Wrangler Tail

**Pros:**
- Real-time streaming
- Simple, works out of the box
- No setup required

**Cons:**
- Requires CLI (`wrangler` must be installed/auth'd)
- Connection can be flaky
- Not programmatic (spawns process)
- Can't query historical data

## Alternatives

### 1. Analytics Engine (SQL API)

**How it works:**
- Worker writes structured logs to Analytics Engine dataset
- Query via SQL API: `SELECT * FROM logs WHERE requestId = '...'`
- Polling-based (query every N seconds)

**Pros:**
- Programmatic (HTTP API)
- Queryable (filter by requestId, stage, action, etc.)
- Reliable (no CLI dependency)
- Historical data access
- Works in CI/CD

**Cons:**
- Not real-time (polling delay)
- Requires setup (dataset binding, write code)
- May have 1-2 second delay

**Implementation:**
```typescript
Observe.analyticsEngine({
  accountId: "...",
  apiToken: "...",
  dataset: "logs",
  pollInterval: 500, // ms
  query: "SELECT * FROM logs WHERE timestamp > ? ORDER BY timestamp"
})
```

### 2. Real-time Logs API

**How it works:**
- Cloudflare's real-time logs endpoint
- WebSocket or HTTP streaming
- Near real-time (sub-second)

**Pros:**
- Real-time
- Programmatic
- No CLI needed

**Cons:**
- May require API token setup
- Less documented
- Rate limits?

### 3. Custom Log Endpoint

**How it works:**
- Worker exposes `/logs` endpoint
- Streams structured logs via SSE or WebSocket
- Full control

**Pros:**
- Full control
- Real-time
- No external dependencies
- Can filter/transform server-side

**Cons:**
- Need to build it
- Adds complexity to worker

### 4. Tail Workers

**How it works:**
- Worker with `tail()` handler
- Receives log events programmatically
- Can forward to external service

**Pros:**
- Programmatic
- Real-time
- Can transform/filter

**Cons:**
- Requires separate worker
- More setup

## Recommended Architecture

**Pluggable Observe Backend:**

```typescript
export namespace Observe {
  export type Tail = 
    | { _tag: "WranglerTail"; accountId?: string }
    | { _tag: "AnalyticsEngine"; accountId: string; apiToken: string; dataset: string; pollInterval?: number }
    | { _tag: "CustomEndpoint"; url: string; headers?: Record<string, string> }
    | { _tag: "Hybrid"; primary: Tail; fallback: Tail };

  export const wranglerTail = (opts?: { accountId?: string }): Tail => ({
    _tag: "WranglerTail",
    accountId: opts?.accountId
  });

  export const analyticsEngine = (opts: {
    accountId: string;
    apiToken: string;
    dataset: string;
    pollInterval?: number;
  }): Tail => ({
    _tag: "AnalyticsEngine",
    ...opts,
    pollInterval: opts.pollInterval ?? 500
  });

  export const customEndpoint = (opts: {
    url: string;
    headers?: Record<string, string>;
  }): Tail => ({
    _tag: "CustomEndpoint",
    ...opts
  });

  export const hybrid = (primary: Tail, fallback: Tail): Tail => ({
    _tag: "Hybrid",
    primary,
    fallback
  });
}
```

## Best Practice: Hybrid Approach

For production E2E tests:

1. **Primary**: Analytics Engine (reliable, queryable)
2. **Fallback**: Wrangler Tail (real-time, if available)
3. **Custom**: Custom endpoint (if you need full control)

**Why Analytics Engine is better for E2E:**
- More reliable (no CLI dependency)
- Queryable (filter by requestId easily)
- Works in CI/CD
- Can query historical data
- Polling is fine for tests (500ms is fast enough)

**When to use Wrangler Tail:**
- Local development
- Quick debugging
- When you need true real-time

## Implementation Priority

1. ✅ Wrangler Tail (current - works)
2. 🔄 Analytics Engine (add next - more reliable)
3. ⏳ Custom Endpoint (if needed)
4. ⏳ Hybrid mode (best of both)
