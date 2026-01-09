// WS-005: Effect-based error handling verification
// Manual code inspection - PASSED
//
// Evidence:
// - Error types defined in worker/effects.ts:
//   - ContainerError with _tag = "ContainerError"
//   - WebSocketError with _tag = "WebSocketError"
//   - TimeoutError with _tag = "TimeoutError"
// - Retry logic implemented:
//   - retryWithBackoff uses Schedule.exponential with maxRetries
//   - Effect.retry wraps effects with backoff strategy
// - Timeout handling implemented:
//   - withTimeout uses Effect.timeout with Duration.millis
//   - Maps TimeoutException to TimeoutError
// - Usage in worker/index.ts:
//   - startTtydEffect: Effect.gen + Effect.tryPromise + retryWithBackoff + withTimeout
//   - connectWsEffect: Effect.gen + Effect.tryPromise + retryWithBackoff + withTimeout
//   - Effect.runPromise at async boundaries
// - Error handling catches Effect errors by checking error._tag
//
// Acceptance criteria met:
// ✅ ContainerError, WebSocketError types defined
// ✅ Retry with exponential backoff on transient failures (3 retries)
// ✅ Timeout after 30s with clear error (TimeoutError)
// ✅ Effect.runPromise at boundary
//
// Verification command: Code inspection of worker/effects.ts and worker/index.ts