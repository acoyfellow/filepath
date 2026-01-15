# Architecture Review & Renaming Plan

## Current Issues

1. **Naming**: "wrangler-harness" implies Wrangler dependency, but we're moving to Analytics Engine
2. **Abstraction**: "Tail" is Wrangler-specific terminology
3. **Missing Backends**: No support for Workers Logs API, Log Explorer, Tail Workers
4. **No Hybrid Mode**: Can't use multiple backends simultaneously
5. **No Local Dev Mode**: No way to test without Cloudflare

## Proposed Renames

### Library Name
- `wrangler-harness` → `cloudflare-harness` or `cf-e2e-harness`
- Better reflects: works with any Cloudflare observability backend

### Core Types
- `Observe.Tail` → `Observe.Backend` or `Observe.Source`
- `wranglerTail()` → `cliStream()` or `processStream()`
- `WranglerTailError` → `ObservabilityError` or `BackendError`
- `defaultTail()` → `default()` or `auto()`

## Architecture Improvements

### 1. Add Workers Logs API Support
Cloudflare's native Workers Logs API (not just Analytics Engine):
- Real-time query API
- Filter by RayID, time range, worker name
- Better for production debugging

### 2. Add Hybrid Mode
Use multiple backends simultaneously:
- Primary: Analytics Engine (reliable)
- Fallback: CLI stream (real-time)
- Backup: Workers Logs API (queryable)

### 3. Add Local Dev Mode
For testing without Cloudflare:
- Mock backend that collects logs in memory
- Can replay logs from files
- Useful for CI/CD when Cloudflare isn't available

### 4. Better Filtering
- Filter at source (reduce data transfer)
- Filter by requestId, stage, action, error tags
- Time-window queries

### 5. Support Tail Workers
Custom worker that tails another worker:
- Real-time streaming
- Can transform/filter server-side
- No CLI dependency

## Recommended New API

```typescript
// Renamed namespace
export namespace Observe {
  export type Backend =
    | { _tag: "AnalyticsEngine"; ... }
    | { _tag: "WorkersLogs"; ... }      // NEW
    | { _tag: "CliStream"; ... }         // renamed from WranglerTail
    | { _tag: "CustomEndpoint"; ... }
    | { _tag: "TailWorker"; ... }        // NEW
    | { _tag: "Local"; ... }             // NEW
    | { _tag: "Hybrid"; backends: Backend[] }; // NEW

  export const analyticsEngine = ...
  export const workersLogs = (opts: { accountId, apiToken, workerName }) => ...
  export const cliStream = (opts?: { accountId?: string }) => ... // renamed
  export const customEndpoint = ...
  export const tailWorker = (opts: { endpoint: string }) => ...
  export const local = () => ... // for testing
  export const hybrid = (backends: Backend[]) => ...
  export const auto = (opts?: { prefer?: "reliable" | "realtime" }) => ...
}
```

## Migration Path

1. Rename all "Tail" → "Backend" in code
2. Rename `wranglerTail` → `cliStream`
3. Rename `WranglerTailError` → `ObservabilityError`
4. Add new backends (Workers Logs, Tail Worker, Local)
5. Add hybrid mode
6. Update all docs/examples
7. Rename package to `cloudflare-harness`
