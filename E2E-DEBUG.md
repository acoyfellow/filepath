# E2E Debug Harness

Automated end-to-end debugging for Cloudflare Workers with structured logging, error tracking, and browser automation.

## Overview

The E2E debug harness combines:
- **Wrangler Tail** - Real-time production log streaming
- **Playwright** - Automated browser testing
- **Effect** - Reliable async orchestration with typed errors
- **Structured Logging** - AI-friendly JSON logs with correlation IDs

## Usage

```bash
# Basic usage
bun run e2e:test

# Custom worker and URL
CLOUDFLARE_ACCOUNT_ID=xxx bun scripts/e2e-debug.ts worker-name https://worker.workers.dev/
```

## How It Works

1. **Starts log tailing** - Connects to `wrangler tail` for production logs
2. **Launches browser** - Playwright opens headless browser
3. **Navigates to URL** - Loads the worker URL
4. **Captures logs** - Streams structured logs with correlation IDs
5. **Exits cleanly** - Closes after timeout or no logs for 3s

## Log Format

All logs are structured JSON:
```json
{
  "requestId": "abc123...",
  "timestamp": "2025-01-15T...",
  "stage": "worker",
  "action": "request_received",
  "status": "info",
  "data": { "method": "GET", "path": "/" }
}
```

## Integration with Effect

The harness uses Effect for:
- **Error handling** - Tagged errors (ContainerConnectionError, WebSocketError, etc.)
- **Async orchestration** - Reliable queue processing
- **Type safety** - Compile-time error checking

## Scripts

- `bun run e2e` - Run E2E test with defaults
- `bun run e2e:test` - Run with production worker
- `bun run debug` - Manual log tailing
- `bun run debug:raw` - Raw wrangler tail output
