import type { ToolPermission } from "$lib/runtime/authority";

/**
 * Agent Adapter Interfaces
 *
 * Each built-in agent gets an adapter that wraps the CLI tool and
 * translates its output into FAP (filepath Agent Protocol) events.
 *
 * The adapter runs inside the container as the entrypoint process.
 * It receives NDJSON on stdin and emits NDJSON on stdout.
 */

/** Configuration for starting an agent adapter */
export interface AdapterConfig {
  /** Agent type identifier */
  harnessId: string;
  /** Model id to use (ai-connect connection's `model` field) */
  model: string;
  /** Decrypted API key for the connection — injected into container env */
  apiKey: string;
  /** ai-connect provider format: anthropic | openai-chat | openai-responses | gemini */
  provider: string;
  /** Full endpoint URL the adapter should POST to */
  endpoint: string;
  /** Initial task (first user message) */
  task?: string;
  /** Workspace path */
  workspacePath: string;
  /** Allowed paths */
  allowedPaths: string[];
  /** Forbidden paths */
  forbiddenPaths: string[];
  /** Allowed tools/capabilities */
  toolPermissions: ToolPermission[];
  /** Writable sub-root for agent execution */
  writableRoot: string | null;
  /** Harness config (e.g. hermesVersion for Hermes) */
  harnessConfig?: Record<string, unknown>;
  /** Additional env vars */
  envVars?: Record<string, string>;
}

/**
 * Environment variables set for every agent container.
 *
 * The adapter inside the container reads these to dispatch inference via
 * @acoyfellow/ai-connect — the only new adapter-side code needed is a
 * thin dispatch helper that picks request/response shape based on
 * FILEPATH_PROVIDER, then POSTs to FILEPATH_ENDPOINT with FILEPATH_API_KEY.
 */
export function buildAgentEnv(config: AdapterConfig): Record<string, string> {
  return {
    FILEPATH_TASK: config.task || "",
    FILEPATH_API_KEY: config.apiKey,
    FILEPATH_MODEL: config.model,
    FILEPATH_PROVIDER: config.provider,
    FILEPATH_ENDPOINT: config.endpoint,
    FILEPATH_HARNESS_ID: config.harnessId,
    FILEPATH_AGENT_TYPE: config.harnessId,
    FILEPATH_WORKSPACE: config.workspacePath,
    FILEPATH_ALLOWED_PATHS: JSON.stringify(config.allowedPaths),
    FILEPATH_FORBIDDEN_PATHS: JSON.stringify(config.forbiddenPaths),
    FILEPATH_TOOL_PERMISSIONS: JSON.stringify(config.toolPermissions),
    FILEPATH_WRITABLE_ROOT: config.writableRoot ?? "",
    FILEPATH_HARNESS_CONFIG: JSON.stringify(config.harnessConfig ?? {}),
    ...config.envVars,
  };
}
