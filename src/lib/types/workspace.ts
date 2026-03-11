import type { AgentStatus as AgentStatusType } from "$lib/protocol";
import type { NodeRuntimePolicy, ToolPermission } from "$lib/runtime/authority";

export type HarnessId = string;

export type AgentStatus = AgentStatusType;

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
  tokens: number;
  createdAt: number;
  updatedAt: number;
}

export interface WorkspaceRecord {
  id: string;
  userId: string;
  name: string;
  gitRepoUrl?: string | null;
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
  allowedPaths: NodeRuntimePolicy["allowedPaths"];
  forbiddenPaths: NodeRuntimePolicy["forbiddenPaths"];
  toolPermissions: NodeRuntimePolicy["toolPermissions"];
  writableRoot: NodeRuntimePolicy["writableRoot"];
}

export interface AgentResult {
  status: "success" | "error" | "aborted" | "policy_error";
  summary: string;
  commands: Array<{ command: string; exitCode: number | null }>;
  filesTouched: string[];
  violations: string[];
  diffSummary?: string | null;
  commit?: { sha: string; message: string } | null;
  startedAt: number;
  finishedAt: number;
}

export interface AgentRuntimeSnapshot {
  status: AgentStatus;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: number;
  }>;
  result: AgentResult | null;
}
