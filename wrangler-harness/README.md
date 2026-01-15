# wrangler-harness

Effect-first Cloudflare E2E "gate" harness. Minimal, deterministic, AI-friendly.

## Design

- **Stimulus**: exec commands + optional Playwright browser visit
- **Observability**: Pluggable backends (Wrangler Tail, Analytics Engine, Custom Endpoint)
- **Proof**: assertions over structured logs (+ optional browser diagnostics)
- **Stop**: idle/max timeout

**Design goals:**
- AX > DX: machine-shaped result, deterministic failure surface, human-readable optional reporter
- Runs anywhere: local CLI, scripts, CI/CD (as long as wrangler is auth'd)
- Minimal: small surface area, long-term maintainable

## Usage

```typescript
import { Gate, Act, Observe, Assert, Stop, Report } from "wrangler-harness";

const gate = Gate.define({
  name: "deploy+smoke",
  target: { 
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID, 
    workerName: "terminal-app" 
  },
  act: Act.sequence([
    Act.exec("wrangler deploy"),
    Act.browser({ url: "https://terminal-app.example.workers.dev/", headless: true, waitMs: 5000 })
  ]),
  observe: Observe.defaultTail({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    dataset: "worker_logs"
  }),
  assert: [
    Assert.noTaggedErrors(), 
    Assert.requiredActions(["request_received"])
  ],
  stop: Stop.whenIdle({ idleMs: 3000, maxMs: 15000 }),
  report: Report.json({ pretty: true })
});

const res = await Gate.run(gate);
if (res.status !== "success") process.exit(1);
```

## Observability Backends

The library supports multiple observability backends:

### 1. Analytics Engine (Default - Recommended)
Query-based polling via Cloudflare SQL API. Works in both dev and production.

```typescript
observe: Observe.defaultTail({
  accountId: "...",
  apiToken: "...",
  dataset: "worker_logs"
})
```

**Pros:** Reliable, queryable, works in CI/CD, no CLI dependency  
**Cons:** Polling delay (~500ms)

### 2. Wrangler Tail (Fallback)
Query-based polling via Cloudflare SQL API.

```typescript
observe: Observe.analyticsEngine({
  accountId: "...",
  apiToken: "...",
  dataset: "logs",
  pollInterval: 500 // ms
})
```

**Pros:** Reliable, queryable, works in CI/CD  
**Cons:** Polling delay (~500ms)

### 3. Analytics Engine (Explicit)
Same as default, but explicit:

```typescript
observe: Observe.analyticsEngine({
  accountId: "...",
  apiToken: "...",
  dataset: "worker_logs",
  pollInterval: 500
})
```

### 4. Custom Endpoint
Stream logs from your own HTTP endpoint.

```typescript
observe: Observe.customEndpoint({
  url: "https://your-worker.workers.dev/logs",
  headers: { "Authorization": "Bearer ..." }
})
```

**Pros:** Full control, real-time  
**Cons:** Requires building endpoint

## Requirements

- Node.js 18+
- `wrangler` CLI (for Wrangler Tail backend)
- `playwright` (optional, for browser automation)

## Install

```bash
npm install wrangler-harness
# or
bun add wrangler-harness
```

## Development

```bash
# Run tests
bun test

# Type check
bun run typecheck

# Run example
CLOUDFLARE_ACCOUNT_ID=xxx bun example.ts worker-name https://worker.workers.dev/
```

## API

See [src/index.ts](./src/index.ts) for full API documentation.

## License

MIT
