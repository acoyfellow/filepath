import type { AgentStatus as AgentStatusType } from "$lib/protocol";

/** Dynamic harness identifier */
export type HarnessId = string;

/** Agent node status (mirrors protocol AgentStatus) */
export type NodeStatus = AgentStatusType;

/** Session-level status */
export type SessionStatus = "draft" | "running" | "paused" | "stopped" | "error";

/** Configuration stored in agentNode.config JSON column */
export interface AgentNodeConfig {
  systemPrompt?: string;
  envVars?: Record<string, string>;
  maxTokens?: number;
}

/** An agent node in the session tree */
export interface AgentNode {
  id: string;
  sessionId: string;
  parentId: string | null;
  name: string;
  harnessId: HarnessId;
  model: string;
  status: NodeStatus;
  config: AgentNodeConfig;
  containerId?: string;
  sortOrder: number;
  tokens: number;
  children: AgentNode[];
  createdAt: number;
  updatedAt: number;
}

/** An agent session (flat, from DB) */
export interface AgentSession {
  id: string;
  userId: string;
  name: string;
  gitRepoUrl?: string;
  status: SessionStatus;
  rootNodeId?: string;
  startedAt?: number;
  createdAt: number;
  updatedAt: number;
}

/** Spawnable harness entry */
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

/** Spawn request (from spawn modal) */
export interface SpawnRequest {
  name: string;
  harnessId: HarnessId;
  model: string;
  parentId?: string;
}

export interface ThreadMovePayload {
  nodeId: string;
  parentId: string | null;
  sortOrder: number;
}
