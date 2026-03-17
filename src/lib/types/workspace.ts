import type { AgentStatus as AgentStatusType, AgentEventType } from "$lib/protocol";
import type { AgentScope, ToolPermission } from "$lib/runtime/authority";
import type {
  ConversationInterruption,
  ConversationState,
  SharedRunIdentity,
} from "$lib/conversations";

export type HarnessId = string;

export type AgentStatus = AgentStatusType;
export type AgentTaskState =
  | "queued"
  | "starting"
  | "running"
  | "retrying"
  | "succeeded"
  | "failed"
  | "canceled"
  | "stalled";

export type WorkspaceStatus =
  | "draft"
  | "running"
  | "paused"
  | "stopped"
  | "error";

export interface AgentConfig {
  systemPrompt?: string;
  envVars?: Record<string, string>;
  maxTokens?: number;
}

export interface AgentRecord {
  id: string;
  workspaceId: string;
  name: string;
  harnessId: HarnessId;
  model: string;
  status: AgentStatus;
  config: AgentConfig;
  allowedPaths: string[];
  forbiddenPaths: string[];
  toolPermissions: ToolPermission[];
  writableRoot: string | null;
  containerId?: string;
  activeProcessId?: string | null;
  closedAt?: number | null;
  conversationState?: ConversationState;
  latestInterruption?: ConversationInterruption | null;
  activeIdentity?: SharedRunIdentity | null;
  tokens: number;
  createdAt: number;
  updatedAt: number;
}

export interface WorkspaceRecord {
  id: string;
  userId: string;
  name: string;
  gitRepoUrl?: string | null;
  memoryEnabled?: boolean;
  memoryScope?: string | null;
  status: WorkspaceStatus;
  startedAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface AgentHarness {
  id: HarnessId;
  name: string;
  description: string;
  adapter: string;
  entryCommand: string;
  defaultModel: string;
  icon: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface AgentCreateRequest {
  name: string;
  harnessId: HarnessId;
  model: string;
  allowedPaths: AgentScope["allowedPaths"];
  forbiddenPaths: AgentScope["forbiddenPaths"];
  toolPermissions: AgentScope["toolPermissions"];
  writableRoot: AgentScope["writableRoot"];
}

export interface AgentUpdateRequest {
  name?: string;
  harnessId?: HarnessId;
  model?: string;
  allowedPaths?: AgentScope["allowedPaths"];
  forbiddenPaths?: AgentScope["forbiddenPaths"];
  toolPermissions?: AgentScope["toolPermissions"];
  writableRoot?: AgentScope["writableRoot"];
}

export interface AgentResult {
  status: "success" | "error" | "aborted" | "policy_error";
  summary: string;
  commands: Array<{ command: string; exitCode: number | null }>;
  filesTouched: string[];
  violations: string[];
  diffSummary?: string | null;
  patch?: string | null;
  commit?: { sha: string; message: string } | null;
  startedAt: number;
  finishedAt: number;
}

export interface AgentRuntimeActiveTask {
  id: string;
  state: AgentTaskState;
  attempt: number;
  requestId: string;
  acceptedAt: number;
  startedAt: number | null;
  heartbeatAt: number | null;
  finishedAt: number | null;
  errorCode: string | null;
  errorDetail: string | null;
}

export interface AgentTaskAcceptedResponse {
  ok: true;
  taskId: string;
  state: Extract<AgentTaskState, "queued" | "starting" | "running" | "retrying">;
  traceId?: string | null;
}

export interface AgentRuntimeSnapshot {
  status: AgentStatus;
  activeProcessId?: string | null;
  activeTask?: AgentRuntimeActiveTask | null;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: number;
  }>;
  result: AgentResult | null;
}

export interface WorkerRunScopeInput {
  allowedPaths?: readonly string[] | null;
  forbiddenPaths?: readonly string[] | null;
  toolPermissions?: readonly string[] | null;
  writableRoot?: string | null;
}

export interface WorkerRunInput {
  content: string;
  harnessId: HarnessId;
  model: string;
  scope?: WorkerRunScopeInput;
  agentId?: string;
  identity?: Partial<Omit<SharedRunIdentity, "workspaceId" | "conversationId">> | null;
}

export interface WorkerRunResponse {
  status: AgentResult["status"];
  summary: string;
  events: AgentEventType[];
  filesTouched: string[];
  violations: string[];
  diffSummary: string | null;
  patch: string | null;
  commit: { sha: string; message: string } | null;
  agentId: string;
  runId: string;
  traceId: string | null;
  workspaceId: string;
  conversationId: string;
  proofRunId: string | null;
  proofIterationId: string | null;
  startedAt: number;
  finishedAt: number;
}
