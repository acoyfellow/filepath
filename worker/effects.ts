import { Effect, Schedule, Duration } from "effect";

export class ContainerError {
  readonly _tag = "ContainerError";
  constructor(readonly message: string, readonly cause?: unknown) {}
}

export class WebSocketError {
  readonly _tag = "WebSocketError";
  constructor(readonly message: string, readonly cause?: unknown) {}
}

export class TimeoutError {
  readonly _tag = "TimeoutError";
  constructor(readonly message: string) {}
}

export function retryWithBackoff<E, A>(
  effect: Effect.Effect<A, E>,
  maxRetries: number = 3
): Effect.Effect<A, E> {
  return Effect.retry(
    effect,
    Schedule.exponential(Duration.millis(100)).pipe(
      Schedule.compose(Schedule.recurs(maxRetries))
    )
  );
}

export function withTimeout<A, E>(
  effect: Effect.Effect<A, E>,
  timeoutMs: number = 30000
): Effect.Effect<A, E | TimeoutError> {
  return Effect.timeout(effect, Duration.millis(timeoutMs)).pipe(
    Effect.flatMap((result) => {
      if (result === null) {
        return Effect.fail(new TimeoutError(`Operation timed out after ${timeoutMs}ms`));
      }
      return Effect.succeed(result);
    }),
    Effect.mapError((error) => {
      if (error && typeof error === 'object' && '_tag' in error && error._tag === 'TimeoutException') {
        return new TimeoutError(`Operation timed out after ${timeoutMs}ms`);
      }
      return error as E | TimeoutError;
    })
  );
}

