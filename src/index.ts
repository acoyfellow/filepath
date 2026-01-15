/**
 * OpenCode + Sandbox SDK Example
 *
 * This example demonstrates both ways to use OpenCode with Sandbox:
 * 1. Web UI - Browse to / for the full OpenCode web experience
 * 2. Programmatic - POST to /api/test for SDK-based automation
 */
import { getSandbox } from '@cloudflare/sandbox';
import {
  createOpencode,
  createOpencodeServer,
  proxyToOpencode
} from '@cloudflare/sandbox/opencode';
import type { Config, OpencodeClient } from '@opencode-ai/sdk';
import { Effect, Context, Schedule } from 'effect';
import { RequestContext, withRequestContext } from './context';
import { LoggerService, createLoggerService } from './logger';
import {
  ContainerConnectionError,
  SandboxError,
  OpencodeError,
  type AppError
} from './errors';

export { Sandbox } from '@cloudflare/sandbox';

const getConfig = (env: Env): Config => ({
  provider: {
    anthropic: {
      options: {
        apiKey: env.ANTHROPIC_API_KEY
      }
    }
  }
});

function handleRequest(request: Request, env: Env): Effect.Effect<Response, AppError, RequestContext | LoggerService> {
  return Effect.gen(function* () {
    const url = new URL(request.url);
    const logger = yield* LoggerService;
    const context = yield* RequestContext;
    
    yield* logger.log('worker', 'request_received', {
      method: request.method,
      path: url.pathname
    });

    const sandbox = getSandbox(env.Sandbox, 'opencode');

    // Check for WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      yield* logger.log('worker', 'websocket_upgrade_attempt', {
        path: url.pathname
      });
    }

    // Programmatic SDK test endpoint
    if (request.method === 'POST' && url.pathname === '/api/test') {
      return yield* handleSdkTest(sandbox, env);
    }

    // Everything else: Web UI proxy
    const finish = yield* logger.start('worker', 'create_opencode_server');
    const server = yield* Effect.tryPromise({
      try: () =>
        createOpencodeServer(sandbox, {
          directory: '/home/user/agents',
          config: getConfig(env)
        }),
      catch: (error) =>
        new SandboxError({
          requestId: context.requestId,
          stage: 'worker',
          cause: error
        })
    });
    yield* finish();

    const finishProxy = yield* logger.start('worker', 'proxy_to_opencode');
    const response = yield* Effect.tryPromise({
      try: async () => await proxyToOpencode(request, sandbox, server),
      catch: (error) =>
        new SandboxError({
          requestId: context.requestId,
          stage: 'worker',
          cause: error
        })
    });
    yield* finishProxy();

    return response;
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestId = crypto.randomUUID();
    
    const program = withRequestContext(
      requestId,
      handleRequest(request, env)
    ).pipe(
      Effect.provide(Context.make(LoggerService, createLoggerService({ LOGS: (env as any).LOGS }))),
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          const logger = yield* LoggerService;
          yield* logger.error('worker', 'request_failed', error);
          return new Response(
            JSON.stringify({
              success: false,
              error: error._tag,
              message: error.message,
              requestId
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }).pipe(
          Effect.provide(Context.make(LoggerService, createLoggerService({ LOGS: (env as any).LOGS }))),
          Effect.provide(Context.make(RequestContext, { requestId }))
        )
      )
    );

    return Effect.runPromise(program);
  }
};

/**
 * Test the programmatic SDK access
 */
function handleSdkTest(
  sandbox: ReturnType<typeof getSandbox>,
  env: Env
): Effect.Effect<Response, AppError, RequestContext | LoggerService> {
  return Effect.gen(function* () {
    const logger = yield* LoggerService;
    const context = yield* RequestContext;

    // Clone a repo to give the agent something to work with
    const finishCheckout = yield* logger.start('worker', 'git_checkout');
    yield* Effect.tryPromise({
      try: () =>
        sandbox.gitCheckout('https://github.com/cloudflare/agents.git', {
          targetDir: '/home/user/agents'
        }),
      catch: (error) =>
        new SandboxError({
          requestId: context.requestId,
          stage: 'worker',
          cause: error
        })
    }).pipe(
      Effect.retry(
        Schedule.exponential('100 millis').pipe(Schedule.compose(Schedule.recurs(3)))
      ),
      Effect.timeout('30 seconds'),
      Effect.mapError((error) => {
        if (error._tag === 'TimeoutException') {
          return new SandboxError({
            requestId: context.requestId,
            stage: 'worker',
            cause: error
          });
        }
        return error as AppError;
      })
    );
    yield* finishCheckout();

    // Get typed SDK client
    const finishCreateClient = yield* logger.start('worker', 'create_opencode_client');
    const { client } = yield* Effect.tryPromise({
      try: () =>
        createOpencode<OpencodeClient>(sandbox, {
          directory: '/home/user/agents',
          config: getConfig(env)
        }),
      catch: (error) =>
        new OpencodeError({
          requestId: context.requestId,
          stage: 'worker',
          cause: error
        })
    });
    yield* finishCreateClient();

    // Create a session
    const finishCreateSession = yield* logger.start('worker', 'create_session');
    const session = yield* Effect.tryPromise({
      try: () =>
        client.session.create({
          body: { title: 'Test Session' },
          query: { directory: '/home/user/agents' }
        }),
      catch: (error) =>
        new OpencodeError({
          requestId: context.requestId,
          stage: 'worker',
          cause: error
        })
    });
    yield* finishCreateSession();

    if (!session.data) {
      throw new OpencodeError({
        requestId: context.requestId,
        stage: 'worker',
        cause: `Failed to create session: ${JSON.stringify(session)}`
      });
    }

    // Send a prompt using the SDK
    const finishPrompt = yield* logger.start('worker', 'send_prompt');
    const promptResult = yield* Effect.tryPromise({
      try: () =>
        client.session.prompt({
          path: { id: session.data.id },
          query: { directory: '/home/user/agents' },
          body: {
            model: {
              providerID: 'anthropic',
              modelID: 'claude-haiku-4-5'
            },
            parts: [
              {
                type: 'text',
                text: 'Summarize the README.md file in 2-3 sentences. Be concise.'
              }
            ]
          }
        }),
      catch: (error) =>
        new OpencodeError({
          requestId: context.requestId,
          stage: 'worker',
          cause: error
        })
    }).pipe(
      Effect.timeout('60 seconds'),
      Effect.mapError((error) => {
        if (error._tag === 'TimeoutException') {
          return new OpencodeError({
            requestId: context.requestId,
            stage: 'worker',
            cause: error
          });
        }
        return error as AppError;
      })
    );
    yield* finishPrompt();

    // Extract text response from result
    const parts = promptResult.data?.parts ?? [];
    const textPart = parts.find((p: { type: string }) => p.type === 'text') as
      | { text?: string }
      | undefined;

    return new Response(textPart?.text ?? 'No response', {
      headers: { 'Content-Type': 'text/plain' }
    });
  });
}
