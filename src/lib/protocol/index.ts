/**
 * filepath Agent Protocol (FAP)
 *
 * Single source of truth for all protocol types.
 * Import from here -- not from individual files.
 *
 * Usage:
 *   import { AgentEvent, AgentInput, AgentStatus } from '$lib/protocol';
 */

export {
  // Status
  AgentStatus,
  STATUS_COLORS,
  STATUS_LABELS,

  // Output events (agent → DO → frontend)
  TextEvent,
  ToolEvent,
  CommandEvent,
  CommitEvent,
  SpawnEvent,
  WorkersEvent,
  StatusEvent,
  HandoffEvent,
  DoneEvent,
  AgentEvent,

  // Input messages (DO → agent)
  UserMessage,
  SignalMessage,
  AgentInput,
} from "./events";

export type {
  AgentStatus as AgentStatusType,
  TextEvent as TextEventType,
  ToolEvent as ToolEventType,
  CommandEvent as CommandEventType,
  CommitEvent as CommitEventType,
  SpawnEvent as SpawnEventType,
  WorkersEvent as WorkersEventType,
  StatusEvent as StatusEventType,
  HandoffEvent as HandoffEventType,
  DoneEvent as DoneEventType,
  AgentEvent as AgentEventType,
  UserMessage as UserMessageType,
  SignalMessage as SignalMessageType,
  AgentInput as AgentInputType,
} from "./events";

// ─── Utilities ───

import { AgentEvent, AgentInput } from "./events";

/** Parse a single line of NDJSON stdout from an agent container */
export function parseAgentEvent(line: string): AgentEvent | null {
  try {
    const json = JSON.parse(line);
    const result = AgentEvent.safeParse(json);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Parse a single line of NDJSON stdin destined for an agent container */
export function parseAgentInput(line: string): AgentInput | null {
  try {
    const json = JSON.parse(line);
    const result = AgentInput.safeParse(json);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Serialize an event to NDJSON (one line, no trailing newline) */
export function serializeEvent(event: AgentEvent): string {
  return JSON.stringify(event);
}

/** Serialize an input message to NDJSON */
export function serializeInput(input: AgentInput): string {
  return JSON.stringify(input);
}
