/**
 * filepath Agent Protocol (FAP) -- Event Types
 *
 * These Zod schemas define every structured event an agent can emit via stdout.
 * They are the single source of truth for the protocol. The runtime validates
 * incoming events against these schemas. The frontend renders based on the `type`
 * discriminator.
 *
 * NDJSON: one JSON object per line, each validated against AgentEvent.
 */

import { z } from "zod";

// ─── Agent Status (shared across events and UI) ───

export const AgentStatus = z.enum([
  "idle",
  "queued",
  "starting",
  "thinking",
  "running",
  "retrying",
  "done",
  "stalled",
  "exhausted",
  "error",
]);
export type AgentStatus = z.infer<typeof AgentStatus>;

export const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: "#52525b",
  queued: "#6366f1",
  starting: "#8b5cf6",
  thinking: "#f59e0b",
  running: "#818cf8",
  retrying: "#f97316",
  done: "#22c55e",
  stalled: "#f97316",
  exhausted: "#f97316",
  error: "#ef4444",
};

export const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: "Idle",
  queued: "Queued",
  starting: "Starting",
  thinking: "Thinking",
  running: "Running",
  retrying: "Retrying",
  done: "Done",
  stalled: "Stalled",
  exhausted: "Exhausted",
  error: "Error",
};

// ─── Output Events (agent stdout → DO → frontend) ───

/** Agent says something in natural language */
export const TextEvent = z.object({
  type: z.literal("text"),
  content: z.string(),
});
export type TextEvent = z.infer<typeof TextEvent>;

/** Agent invoked a tool (write_file, read_file, edit_file, etc.) */
export const ToolEvent = z.object({
  type: z.literal("tool"),
  name: z.string(),
  path: z.string().optional(),
  status: z.enum(["start", "done", "error"]),
  output: z.string().optional(),
});
export type ToolEvent = z.infer<typeof ToolEvent>;

/** Agent ran a shell command */
export const CommandEvent = z.object({
  type: z.literal("command"),
  cmd: z.string(),
  status: z.enum(["start", "done", "error"]),
  exit: z.number().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
});
export type CommandEvent = z.infer<typeof CommandEvent>;

/** Agent made a git commit */
export const CommitEvent = z.object({
  type: z.literal("commit"),
  hash: z.string(),
  message: z.string(),
});
export type CommitEvent = z.infer<typeof CommitEvent>;

/** Agent requests spawning a child agent */
export const SpawnEvent = z.object({
  type: z.literal("spawn"),
  name: z.string(),
  agent: z.string(),
  model: z.string(),
  task: z.string().optional(),
});
export type SpawnEvent = z.infer<typeof SpawnEvent>;

/** Agent reports status of related agents */
export const AgentsEvent = z.object({
  type: z.literal("agents"),
  agents: z.array(
    z.object({
      name: z.string(),
      status: AgentStatus,
    }),
  ),
});
export type AgentsEvent = z.infer<typeof AgentsEvent>;

/** Agent reports its own status (context usage, state change) */
export const StatusEvent = z.object({
  type: z.literal("status"),
  state: AgentStatus,
  context_pct: z.number().min(0).max(1).optional(),
});
export type StatusEvent = z.infer<typeof StatusEvent>;

/** Agent reports context exhaustion with a terminal summary */
export const HandoffEvent = z.object({
  type: z.literal("handoff"),
  summary: z.string(),
});
export type HandoffEvent = z.infer<typeof HandoffEvent>;

/** Agent declares it is finished */
export const DoneEvent = z.object({
  type: z.literal("done"),
  summary: z.string().optional(),
});
export type DoneEvent = z.infer<typeof DoneEvent>;

/** Discriminated union of all agent output events */
export const AgentEvent = z.discriminatedUnion("type", [
  TextEvent,
  ToolEvent,
  CommandEvent,
  CommitEvent,
  SpawnEvent,
  AgentsEvent,
  StatusEvent,
  HandoffEvent,
  DoneEvent,
]);
export type AgentEvent = z.infer<typeof AgentEvent>;

// ─── Input Messages (DO stdin → agent container) ───

/** Message from user, parent agent, or system */
export const UserMessage = z.object({
  type: z.literal("message"),
  from: z.enum(["user", "parent", "system"]),
  content: z.string(),
});
export type UserMessage = z.infer<typeof UserMessage>;

/** Lifecycle signal to the agent */
export const SignalMessage = z.object({
  type: z.literal("signal"),
  action: z.enum(["stop", "pause", "resume"]),
});
export type SignalMessage = z.infer<typeof SignalMessage>;

/** Discriminated union of all agent input messages */
export const AgentInput = z.discriminatedUnion("type", [
  UserMessage,
  SignalMessage,
]);
export type AgentInput = z.infer<typeof AgentInput>;
