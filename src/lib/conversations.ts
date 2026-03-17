import type { ToolPermission } from "$lib/runtime/authority";

export type ConversationState = "ready" | "running" | "blocked" | "closed";
export type ConversationInterruptionKind = "approval" | "pause";
export type ConversationInterruptionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "resumed";

export interface SharedRunIdentity {
  traceId: string | null;
  workspaceId: string;
  conversationId: string;
  runId: string | null;
  proofRunId: string | null;
  proofIterationId: string | null;
}

export interface ConversationInterruption {
  id: string;
  kind: ConversationInterruptionKind;
  status: ConversationInterruptionStatus;
  summary: string;
  requestedPermission: ToolPermission | null;
  payload: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  resolvedAt: number | null;
  identity: SharedRunIdentity;
}

export interface ConversationStateInput {
  closedAt?: number | null;
  hasActiveTask?: boolean;
  latestInterruption?: {
    status: ConversationInterruptionStatus;
  } | null;
}

export const deriveConversationState = (
  input: ConversationStateInput,
): ConversationState => {
  if (input.closedAt) return "closed";
  if (input.latestInterruption?.status === "pending") return "blocked";
  if (input.hasActiveTask) return "running";
  return "ready";
};
