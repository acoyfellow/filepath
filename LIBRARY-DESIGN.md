# Cloudflare E2E Debug Library - Design Proposal

## Vision

A reusable TypeScript library for automated end-to-end debugging of Cloudflare Workers, designed for AI agents first, then humans. Provides tight feedback loops with structured logging, error tracking, and browser automation.

## Core Principles

1. **Effect-Powered** - All async operations use Effect for reliability
2. **Type-Safe Errors** - Tagged errors with Schema.TaggedError
3. **AI-Friendly** - Structured JSON logs with correlation IDs
4. **Cloudflare-First** - Built specifically for Workers ecosystem
5. **Tight Feedback Loops** - Fast, automated, repeatable

## API Surface Area

### Core API

```typescript
import { createE2EDebugger } from '@cloudflare/e2e-debug';
import { Effect } from 'effect';

// Basic usage
const debugger = createE2EDebugger({
  workerName: 'my-worker',
  accountId: 'xxx',
  url: 'https://my-worker.workers.dev/'
});

// Run test
await debugger.run();

// With custom test steps
await debugger.run({
  steps: [
    { action: 'navigate', url: 'https://...' },
    { action: 'wait', ms: 5000 },
    { action: 'click', selector: '#button' },
    { action: 'waitForLog', pattern: { action: 'websocket_connect' } }
  ]
});

// Effect-based API (for composition)
const program = debugger.runEffect().pipe(
  Effect.tap((result) => Effect.log(`Test completed: ${result.status}`)),
  Effect.catchAll((error) => 
    Effect.gen(function* () {
      yield* Effect.log(`Test failed: ${error._tag}`);
      return { status: 'failed', error };
    })
  )
);

await Effect.runPromise(program);
```

### Advanced Configuration

```typescript
const debugger = createE2EDebugger({
  workerName: 'my-worker',
  accountId: 'xxx',
  url: 'https://my-worker.workers.dev/',
  
  // Logging configuration
  logging: {
    format: 'json', // 'json' | 'pretty' | 'minimal'
    filter: {
      requestId: 'abc123',
      stage: 'worker',
      minLevel: 'error'
    },
    timeout: 10000 // ms to wait for logs
  },
  
  // Browser configuration
  browser: {
    headless: false,
    viewport: { width: 1280, height: 720 },
    timeout: 30000
  },
  
  // Test configuration
  test: {
    waitForLogs: true,
    logTimeout: 5000,
    successCriteria: {
      noErrors: true,
      requiredActions: ['websocket_connect', 'container_start']
    }
  }
});
```

### Error Types

```typescript
// Tagged errors for type-safe error handling
class LogTimeoutError extends Schema.TaggedError<LogTimeoutError>()(
  'LogTimeoutError',
  { timeoutMs: Schema.Number }
) {}

class BrowserError extends Schema.TaggedError<BrowserError>()(
  'BrowserError',
  { 
    action: Schema.String,
    cause: Schema.Unknown 
  }
) {}

class WranglerError extends Schema.TaggedError<WranglerError>()(
  'WranglerError',
  { 
    command: Schema.String,
    cause: Schema.Unknown 
  }
) {}

type E2EDebugError = LogTimeoutError | BrowserError | WranglerError;
```

### Log Processing

```typescript
// Custom log processor
const processor = createLogProcessor({
  onLog: (log: StructuredLog) => {
    if (log.status === 'error') {
      console.error(`Error: ${log.error?.tag}`);
    }
  },
  onRequestComplete: (requestId: string, logs: StructuredLog[]) => {
    console.log(`Request ${requestId} completed with ${logs.length} logs`);
  }
});

await debugger.run({ processor });
```

### Stagehand Integration

```typescript
import { createStagehandAgent } from '@cloudflare/e2e-debug/stagehand';

// Use Stagehand for AI-driven browser automation
const agent = createStagehandAgent({
  model: 'claude-3-5-sonnet',
  instructions: 'Test the WebSocket connection flow'
});

await debugger.run({
  automation: agent,
  steps: [
    { type: 'ai', prompt: 'Navigate to the terminal and connect' }
  ]
});
```

### Test Scenarios

```typescript
// Pre-built test scenarios
import { scenarios } from '@cloudflare/e2e-debug/scenarios';

// WebSocket connection test
await debugger.run(scenarios.websocketConnection({
  endpoint: '/terminal/{id}/ws',
  waitForOpen: true
}));

// Container lifecycle test
await debugger.run(scenarios.containerLifecycle({
  verifyStart: true,
  verifyStop: true
}));

// Custom scenario
const myScenario = createScenario({
  name: 'user-login-flow',
  steps: [
    { action: 'navigate', url: '/login' },
    { action: 'fill', selector: '#email', value: 'test@example.com' },
    { action: 'click', selector: '#submit' },
    { action: 'waitForLog', pattern: { action: 'auth_success' } }
  ],
  assertions: [
    { type: 'logExists', pattern: { action: 'session_created' } },
    { type: 'noErrors', stages: ['worker', 'durable_object'] }
  ]
});

await debugger.run(myScenario);
```

### Result Types

```typescript
interface TestResult {
  status: 'success' | 'failed' | 'timeout';
  duration: number;
  logs: StructuredLog[];
  errors: E2EDebugError[];
  browser: {
    url: string;
    consoleErrors: string[];
    networkFailures: string[];
  };
  summary: {
    totalRequests: number;
    requestsByStage: Record<Stage, number>;
    errorsByType: Record<string, number>;
  };
}
```

## Library Architecture

### Core Modules

1. **`@cloudflare/e2e-debug/core`**
   - Effect-based orchestration
   - Queue management
   - Log processing

2. **`@cloudflare/e2e-debug/browser`**
   - Playwright integration
   - Browser automation
   - Console/network capture

3. **`@cloudflare/e2e-debug/wrangler`**
   - Wrangler tail integration
   - Log streaming
   - Account/worker management

4. **`@cloudflare/e2e-debug/logging`**
   - Structured log parsing
   - Correlation ID tracking
   - Log filtering/formatting

5. **`@cloudflare/e2e-debug/stagehand`**
   - Stagehand agent integration
   - AI-driven automation
   - Natural language test steps

6. **`@cloudflare/e2e-debug/scenarios`**
   - Pre-built test scenarios
   - Common patterns
   - Assertion helpers

### Effect Services

```typescript
// LoggerService - Structured logging
interface LoggerService {
  log(stage: Stage, action: string, data?: unknown): Effect.Effect<void>;
  error(stage: Stage, action: string, error: TaggedError): Effect.Effect<void>;
}

// BrowserService - Playwright automation
interface BrowserService {
  navigate(url: string): Effect.Effect<void>;
  click(selector: string): Effect.Effect<void>;
  wait(ms: number): Effect.Effect<void>;
}

// WranglerService - Log tailing
interface WranglerService {
  tail(workerName: string): Effect.Effect<Stream<StructuredLog>>;
}
```

## Usage Examples

### For AI Agents

```typescript
// AI agents can use the Effect API for composition
const debugFlow = Effect.gen(function* () {
  const debugger = yield* createE2EDebugger({...});
  const result = yield* debugger.runEffect();
  
  // Type-safe error handling
  if (result.status === 'failed') {
    yield* Effect.log(`Failed: ${result.errors[0]._tag}`);
    return yield* analyzeFailure(result);
  }
  
  return result;
});

await Effect.runPromise(debugFlow);
```

### For Humans

```typescript
// Simple, intuitive API
const result = await debugger.run({
  url: 'https://my-app.workers.dev/',
  wait: 5000
});

if (result.status === 'success') {
  console.log('✅ All tests passed!');
} else {
  console.error('❌ Test failed:', result.errors);
}
```

## Key Features

1. **Zero Configuration** - Works out of the box with sensible defaults
2. **Type Safety** - Full TypeScript support with Effect types
3. **Composable** - Effect-based API allows composition
4. **Extensible** - Plugin system for custom scenarios
5. **Fast** - Optimized for tight feedback loops
6. **AI-Friendly** - Structured logs, typed errors, clear APIs

## Implementation Notes

- All async operations use Effect for reliability
- Errors are tagged with Schema.TaggedError for pattern matching
- Logs are structured JSON for easy parsing
- Queue-based log processing prevents blocking
- Timeout-based exit prevents hanging
- Browser automation is non-blocking and composable
