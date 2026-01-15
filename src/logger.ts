import { Context, Effect, Console } from 'effect';
import { RequestContext } from './context';
import type { AppError } from './errors';

export type Stage = 'worker' | 'durable_object' | 'container';
export type LogStatus = 'start' | 'success' | 'error' | 'info';

interface LogEntry {
  requestId: string;
  timestamp: string;
  stage: Stage;
  action: string;
  status: LogStatus;
  durableObjectId?: string;
  containerId?: string;
  error?: {
    tag: string;
    message: string;
    stack?: string;
  };
  data?: Record<string, unknown>;
  durationMs?: number;
}

export interface LoggerService {
  log(stage: Stage, action: string, data?: Record<string, unknown>): Effect.Effect<void, never, RequestContext>;
  error(stage: Stage, action: string, error: AppError): Effect.Effect<void, never, RequestContext>;
  start(stage: Stage, action: string): Effect.Effect<() => Effect.Effect<void, never, RequestContext>, never, RequestContext>;
}

export interface LoggerEnv {
  LOGS?: AnalyticsEngineDataset;
}

export const LoggerService = Context.GenericTag<LoggerService>('LoggerService');

function createLogEntry(
  context: RequestContext,
  stage: Stage,
  action: string,
  status: LogStatus,
  error?: AppError,
  data?: Record<string, unknown>,
  durationMs?: number
): LogEntry {
  return {
    requestId: context.requestId,
    timestamp: new Date().toISOString(),
    stage,
    action,
    status,
    ...(context.durableObjectId && { durableObjectId: context.durableObjectId }),
    ...(context.containerId && { containerId: context.containerId }),
    ...(error && {
      error: {
        tag: error._tag,
        message: error.message,
        stack: error.stack
      }
    }),
    ...(data && { data }),
    ...(durationMs !== undefined && { durationMs })
  };
}

export function createLoggerService(env?: LoggerEnv): LoggerService {
  return LoggerService.of({
    log(stage: Stage, action: string, data?: Record<string, unknown>) {
      return Effect.gen(function* () {
        const context = yield* RequestContext;
        const entry = createLogEntry(context, stage, action, 'info', undefined, data);
        
        // Always log to console (for local dev / wrangler tail)
        yield* Console.log(JSON.stringify(entry));
        
        // Also write to Analytics Engine if available
        if (env?.LOGS) {
          env.LOGS.writeDataPoint({
            blobs: [
              entry.requestId,
              entry.stage,
              entry.action,
              entry.status,
              entry.durableObjectId || '',
              entry.containerId || '',
              entry.error ? entry.error.tag : '',
              entry.error ? entry.error.message : '',
              data ? JSON.stringify(data) : ''
            ],
            doubles: [entry.durationMs || 0, Date.now()],
            indexes: [entry.requestId]
          });
        }
      });
    },

    error(stage: Stage, action: string, error: AppError) {
      return Effect.gen(function* () {
        const context = yield* RequestContext;
        const entry = createLogEntry(context, stage, action, 'error', error);
        
        // Always log to console
        yield* Console.error(JSON.stringify(entry));
        
        // Also write to Analytics Engine if available
        if (env?.LOGS) {
          env.LOGS.writeDataPoint({
            blobs: [
              entry.requestId,
              entry.stage,
              entry.action,
              entry.status,
              entry.durableObjectId || '',
              entry.containerId || '',
              entry.error?.tag || '',
              entry.error?.message || '',
              entry.error?.stack || ''
            ],
            doubles: [0, Date.now()],
            indexes: [entry.requestId]
          });
        }
      });
    },

    start(stage: Stage, action: string) {
      return Effect.gen(function* () {
        const context = yield* RequestContext;
        const startTime = Date.now();
        const entry = createLogEntry(context, stage, action, 'start');
        
        // Always log to console
        yield* Console.log(JSON.stringify(entry));
        
        // Also write to Analytics Engine if available
        if (env?.LOGS) {
          env.LOGS.writeDataPoint({
            blobs: [
              entry.requestId,
              entry.stage,
              entry.action,
              entry.status,
              entry.durableObjectId || '',
              entry.containerId || ''
            ],
            doubles: [0, startTime],
            indexes: [entry.requestId]
          });
        }

        return () =>
          Effect.gen(function* () {
            const endContext = yield* RequestContext;
            const durationMs = Date.now() - startTime;
            const endEntry = createLogEntry(
              endContext,
              stage,
              action,
              'success',
              undefined,
              undefined,
              durationMs
            );
            
            // Always log to console
            yield* Console.log(JSON.stringify(endEntry));
            
            // Also write to Analytics Engine if available
            if (env?.LOGS) {
              env.LOGS.writeDataPoint({
                blobs: [
                  endEntry.requestId,
                  endEntry.stage,
                  endEntry.action,
                  endEntry.status,
                  endEntry.durableObjectId || '',
                  endEntry.containerId || ''
                ],
                doubles: [durationMs, Date.now()],
                indexes: [endEntry.requestId]
              });
            }
          });
      });
    }
  });
}

export const LoggerServiceLive = createLoggerService();
