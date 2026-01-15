import { Schema } from '@effect/schema';

export class ContainerConnectionError extends Schema.TaggedError<ContainerConnectionError>()(
  'ContainerConnectionError',
  {
    requestId: Schema.String,
    containerId: Schema.optional(Schema.String),
    stage: Schema.Literal('worker', 'durable_object', 'container'),
    cause: Schema.Unknown
  }
) {}

export class WebSocketError extends Schema.TaggedError<WebSocketError>()(
  'WebSocketError',
  {
    requestId: Schema.String,
    durableObjectId: Schema.optional(Schema.String),
    containerId: Schema.optional(Schema.String),
    stage: Schema.Literal('worker', 'durable_object', 'container'),
    cause: Schema.Unknown
  }
) {}

export class SandboxError extends Schema.TaggedError<SandboxError>()(
  'SandboxError',
  {
    requestId: Schema.String,
    durableObjectId: Schema.optional(Schema.String),
    stage: Schema.Literal('worker', 'durable_object', 'container'),
    cause: Schema.Unknown
  }
) {}

export class OpencodeError extends Schema.TaggedError<OpencodeError>()(
  'OpencodeError',
  {
    requestId: Schema.String,
    stage: Schema.Literal('worker', 'durable_object', 'container'),
    cause: Schema.Unknown
  }
) {}

export type AppError =
  | ContainerConnectionError
  | WebSocketError
  | SandboxError
  | OpencodeError;
