import { Context, Effect } from 'effect';

export interface RequestContext {
  requestId: string;
  durableObjectId?: string;
  containerId?: string;
}

export const RequestContext = Context.GenericTag<RequestContext>('RequestContext');

export function withRequestContext<R, E, A>(
  requestId: string,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, Exclude<R, RequestContext>> {
  return Effect.provide(effect, Context.make(RequestContext, { requestId }));
}

export function getRequestContext(): Effect.Effect<RequestContext, never, RequestContext> {
  return RequestContext;
}
