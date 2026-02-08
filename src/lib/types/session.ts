import type { AgentStatus as AgentStatusType } from "$lib/protocol";

/** Supported agent types (harnesses) */
export type AgentType =
  | "shelley"
  | "pi"
  | "claude-code"
  | "codex"
  | "cursor"
  | "amp"
  | "custom";

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
  agentType: AgentType;
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
  lastBilledAt?: number;
  createdAt: number;
  updatedAt: number;
}

/** Agent catalog entry */
export interface AgentCatalogEntry {
  id: AgentType;
  name: string;
  description: string;
  defaultModel: string;
  icon: string;
}

/** Spawn request (from spawn modal) */
export interface SpawnRequest {
  name: string;
  agentType: AgentType;
  model: string;
  parentId?: string;
}
