/**
 * Agent Adapter Interfaces
 *
 * Each built-in agent gets an adapter that wraps the CLI tool and
 * translates its output into FAP (filepath Agent Protocol) events.
 *
 * The adapter runs inside the container as the entrypoint process.
 * It receives NDJSON on stdin and emits NDJSON on stdout.
 */

import type { AgentType } from "$lib/types/session";

/** Configuration for starting an agent adapter */
export interface AdapterConfig {
  /** Agent type identifier */
  agentType: AgentType;
  /** Model to use for LLM calls */
  model: string;
  /** API key for LLM provider */
  apiKey: string;
  /** Initial task (first user message) */
  task?: string;
  /** Workspace path (cloned repo) */
  workspacePath: string;
  /** Additional env vars */
  envVars?: Record<string, string>;
}

/** Adapter entrypoint command for each built-in agent */
export const ADAPTER_COMMANDS: Record<string, string> = {
  shelley: "node /opt/filepath/adapters/shelley/index.mjs",
  pi: "node /opt/filepath/adapters/pi/index.mjs",
  "claude-code": "node /opt/filepath/adapters/claude-code/index.mjs",
  codex: "node /opt/filepath/adapters/codex/index.mjs",
  cursor: "node /opt/filepath/adapters/cursor/index.mjs",
  amp: "node /opt/filepath/adapters/amp/index.mjs",
  custom: "", // BYO -- user provides their own entrypoint
};

/** Docker image for each built-in agent */
export const AGENT_IMAGES: Record<string, string> = {
  shelley: "filepath/agent-shelley:latest",
  pi: "filepath/agent-pi:latest",
  "claude-code": "filepath/agent-claude-code:latest",
  codex: "filepath/agent-codex:latest",
  cursor: "filepath/agent-cursor:latest",
  amp: "filepath/agent-amp:latest",
  custom: "filepath/agent-base:latest", // Base image, user builds on top
};

/**
 * Environment variables set for every agent container.
 */
export function buildAgentEnv(config: AdapterConfig): Record<string, string> {
  return {
    FILEPATH_TASK: config.task || "",
    FILEPATH_API_KEY: config.apiKey,
    FILEPATH_MODEL: config.model,
    FILEPATH_AGENT_TYPE: config.agentType,
    FILEPATH_WORKSPACE: config.workspacePath,
    ...config.envVars,
  };
}
