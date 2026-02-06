/** Agent roles in a session */
export type AgentRole = 'orchestrator' | 'worker';

/** Supported agent types */
export type AgentType = 'shelley' | 'pi' | 'opencode' | 'codex' | 'amp' | 'claude-code' | 'custom';

/** LLM model options */
export type ModelId = 
  | 'claude-opus-4-6'
  | 'claude-sonnet-4'
  | 'gpt-4o'
  | 'o3'
  | 'deepseek-r1'
  | 'gemini-2.5-pro';

/** Router/provider for API calls */
export type RouterId = 'direct' | 'openrouter' | 'fireworks';

/** Configuration for a single agent in a session */
export interface AgentConfig {
  model: ModelId;
  router: RouterId;
  systemPrompt?: string;
  envVars?: Record<string, string>;
  maxTokens?: number;
}

/** An agent slot within a session */
export interface AgentSlot {
  id: string;
  sessionId: string;
  role: AgentRole;
  agentType: AgentType;
  name: string;
  config: AgentConfig;
  containerId?: string;
  status: 'pending' | 'starting' | 'running' | 'stopped' | 'error';
  createdAt: number;
  updatedAt: number;
}

/** A multi-agent session */
export interface MultiAgentSession {
  id: string;
  userId: string;
  name: string;
  description?: string;
  gitRepoUrl?: string;
  status: 'draft' | 'starting' | 'running' | 'paused' | 'stopped' | 'error';
  orchestratorSlotId?: string;
  createdAt: number;
  updatedAt: number;
}

/** Catalog entry for an agent type */
export interface AgentCatalogEntry {
  id: AgentType;
  name: string;
  description: string;
  roles: AgentRole[];
  defaultModel: ModelId;
  defaultRouter: RouterId;
  configSchema?: Record<string, unknown>;
  imageName: string;
  icon: string;
}

/** Wizard state for session creation */
export interface SessionWizardState {
  step: 1 | 2 | 3 | 4;
  name: string;
  description: string;
  gitRepoUrl: string;
  orchestrator: {
    agentType: AgentType;
    config: AgentConfig;
  } | null;
  workers: Array<{
    agentType: AgentType;
    name: string;
    config: AgentConfig;
  }>;
}
