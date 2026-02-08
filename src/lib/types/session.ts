import type { AgentStatus as AgentStatusType } from "$lib/protocol";

/** Supported agent types (harnesses) */
export type AgentType =
  | "shelley"
  | "pi"
  | "claude-code"
  | "codex"
  | "cursor"
  | "amp"
  | "opencode"
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

// ============================================================
// Legacy compat types -- needed until wizard + sidebar are rewritten for tree architecture
// ============================================================

export type ModelId = string;
export type RouterId = string;
export type AgentRole = 'orchestrator' | 'worker';

export interface AgentConfig {
  model: string;
  router: string;
  systemPrompt?: string;
  envVars?: Record<string, string>;
}

/** @deprecated Use AgentNode */
export interface AgentSlot {
  id: string;
  sessionId: string;
  role: AgentRole;
  agentType: AgentType;
  name: string;
  config: AgentConfig;
  status: 'pending' | 'starting' | 'running' | 'stopped' | 'error';
  containerId?: string;
}

/** @deprecated Use AgentSession */
export interface MultiAgentSession {
  id: string;
  userId: string;
  name: string;
  description?: string;
  gitRepoUrl?: string;
  status: 'draft' | 'starting' | 'running' | 'paused' | 'stopped' | 'error';
  orchestratorSlotId?: string;
  startedAt?: number;
  lastBilledAt?: number;
  createdAt: number;
  updatedAt: number;
}
