import type { Process, Sandbox } from "@cloudflare/sandbox";
import { parseAgentEvent } from "$lib/protocol";
import type { AgentEventType, AgentStatusType } from "$lib/protocol";
import { buildAgentEnv } from "$lib/agents/adapters";
import type {
  AgentResult,
  AgentRuntimeActiveTask,
  AgentRuntimeSnapshot,
  AgentTaskAcceptedResponse,
  AgentTaskState,
  HarnessId,
} from "$lib/types/workspace";
import {
  getRuntimePolicyViolation,
  isPathAllowed,
  normalizeAgentScope,
  resolveScopedWorkspaceRoot,
  validateAgentScope,
  type AgentScope,
} from "$lib/runtime/authority";
import { decryptApiKey } from "$lib/crypto";
import { resolveBetterAuthSecret } from "$lib/better-auth-secret";
import {
  canonicalizeStoredModel,
  deserializeStoredProviderKeys,
  getProviderForModel,
  normalizeModelForProvider,
  PROVIDERS,
} from "$lib/provider-keys";
import {
  hasWriteIntentEvents,
  normalizeChangeMetadata,
} from "$lib/runtime/change-metadata";
import type { D1Database } from "@cloudflare/workers-types";

export interface RuntimeEnv {
  DB: D1Database;
  Sandbox?: unknown;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
}

export interface RuntimeExecutionContext {
  waitUntil: (promise: Promise<unknown>) => void;
}

interface AgentExecutionConfig {
  harnessId: string;
  model: string;
  policy: AgentScope;
  workspaceId: string;
  gitRepoUrl: string | null;
  entryCommand: string;
  executionRoot: string;
  envVars: Record<string, string>;
}

interface ExecRelay {
  onOutput: (stream: "stdout" | "stderr", data: string) => void;
  flush: () => void;
  checkProtocolError: () => void;
  events: () => AgentEventType[];
  fallbackText: () => string;
  stderrSummary: () => string;
}

interface DirectModelResponse {
  assistantText: string;
  summary: string;
}

export interface AgentTaskCompletion {
  result: AgentResult;
  events: AgentEventType[];
}

interface MessageRow {
  id: string;
  role: string;
  content: string;
  created_at: number;
}

interface TaskRow {
  id: string;
  agent_id: string;
  content: string;
  status: AgentTaskState | AgentResult["status"];
  result_status: AgentResult["status"] | null;
  summary: string;
  commands: string;
  files_touched: string;
  violations: string;
  diff_summary: string | null;
  patch: string | null;
  commit_json: string | null;
  attempt: number | null;
  request_id: string | null;
  error_code: string | null;
  error_detail: string | null;
  accepted_at: number | null;
  started_at: number;
  heartbeat_at: number | null;
  finished_at: number;
}

interface ResultRow {
  result_status: AgentResult["status"];
  summary: string;
  commands: string;
  files_touched: string;
  violations: string;
  diff_summary: string | null;
  patch: string | null;
  commit_json: string | null;
  started_at: number;
  finished_at: number;
}

interface TaskLogContext {
  requestId: string;
  taskId: string;
  workspaceId: string;
  agentId: string;
  harnessId?: string;
  model?: string;
  phase: string;
  attempt?: number;
  durationMs?: number;
  state?: AgentTaskState;
  processId?: string | null;
  errorCode?: string | null;
  errorDetail?: string | null;
}

class RuntimeTaskError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = "RuntimeTaskError";
    this.code = code;
    this.retryable = retryable;
  }
}

let runtimeSchemaReady = false;

const LOCAL_WAIT_PROCESS_ID = "__local_wait__";
const ACTIVE_TASK_STATES = ["queued", "starting", "running", "retrying"] as const;
const TERMINAL_TASK_STATES = ["succeeded", "failed", "canceled", "stalled"] as const;
const TASK_RETRY_LIMIT = 2;
const STARTING_STALE_MS = 60_000;
const RUNNING_STALE_MS = 10 * 60_000;
const HARNESS_SYSTEM_PROMPTS: Record<string, string> = {
  amp:
    "You are Amp running as a filepath harness inside a sandbox. Respond as a large-codebase engineering assistant and obey exact-output requests.",
  "claude-code":
    "You are Claude Code running as a filepath harness inside a sandbox. Respond as a practical coding agent and follow exact-output requests precisely.",
  codex:
    "You are Codex running as a filepath harness inside a sandbox. Respond as a pragmatic coding agent and follow exact-output requests precisely.",
  cursor:
    "You are Cursor Agent running as a filepath harness inside a sandbox. Respond clearly and follow the latest user request exactly when asked for exact output.",
  pi:
    "You are Pi, filepath's research and analysis harness running inside a sandbox. Respond directly and concisely with the best answer to the latest user request.",
  shelley:
    "You are Shelley, filepath's full-stack engineering harness running inside a sandbox. Respond directly to the latest user request. Keep responses plain text unless the user asks otherwise.",
};

function now(): number {
  return Date.now();
}

const TASK_TRANSITIONS: Record<AgentTaskState, readonly AgentTaskState[]> = {
  queued: ["starting", "canceled"],
  starting: ["running", "retrying", "failed", "canceled"],
  running: ["succeeded", "failed", "canceled", "stalled"],
  retrying: ["running", "failed", "canceled"],
  succeeded: [],
  failed: [],
  canceled: [],
  stalled: [],
};

function isValidTaskTransition(from: AgentTaskState, to: AgentTaskState): boolean {
  const allowed = TASK_TRANSITIONS[from];
  return allowed ? (allowed as readonly string[]).includes(to) : false;
}

function isActiveTaskState(state: string): state is Extract<AgentTaskState, (typeof ACTIVE_TASK_STATES)[number]> {
  return (ACTIVE_TASK_STATES as readonly string[]).includes(state);
}

function isTerminalTaskState(
  state: string,
): state is Extract<AgentTaskState, (typeof TERMINAL_TASK_STATES)[number]> {
  return (TERMINAL_TASK_STATES as readonly string[]).includes(state);
}

function mapTaskStateToAgentStatus(state: AgentTaskState): AgentStatusType {
  switch (state) {
    case "queued":
      return "queued";
    case "starting":
      return "starting";
    case "running":
      return "running";
    case "retrying":
      return "retrying";
    case "succeeded":
      return "done";
    case "failed":
      return "error";
    case "canceled":
      return "idle";
    case "stalled":
      return "stalled";
  }
}

function mapResultStatusToTaskState(
  status: AgentResult["status"],
): Extract<AgentTaskState, "succeeded" | "failed" | "canceled"> {
  switch (status) {
    case "success":
      return "succeeded";
    case "aborted":
      return "canceled";
    case "error":
    case "policy_error":
      return "failed";
  }
}

function serializeErrorDetail(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function logTaskEvent(
  level: "log" | "warn" | "error",
  context: TaskLogContext,
): void {
  const entry = {
    ts: new Date().toISOString(),
    component: "runtime",
    ...context,
  };
  console[level](JSON.stringify(entry));
}

function humanizeRuntimeFailureMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (/EISDIR|illegal operation on a directory/i.test(trimmed)) {
    return "A write target resolved to a directory instead of a file. Pick a file path inside the allowed scope.";
  }

  return trimmed;
}

function toRuntimeTaskError(
  error: unknown,
  fallbackCode: string,
  fallbackMessage: string,
  retryable = false,
): RuntimeTaskError {
  if (error instanceof RuntimeTaskError) {
    return error;
  }
  if (error instanceof Error) {
    return new RuntimeTaskError(
      fallbackCode,
      humanizeRuntimeFailureMessage(error.message || fallbackMessage),
      retryable,
    );
  }
  return new RuntimeTaskError(
    fallbackCode,
    humanizeRuntimeFailureMessage(fallbackMessage),
    retryable,
  );
}

function classifySandboxStartupError(error: unknown): RuntimeTaskError {
  const message = serializeErrorDetail(error);
  const retryable = /timeout|tempor|reset|econn|503|502|504|429|unavailable|network/i.test(message);
  return new RuntimeTaskError("SANDBOX_START_FAILED", message, retryable);
}

function classifyProviderError(error: unknown): RuntimeTaskError {
  if (error instanceof RuntimeTaskError) {
    return error;
  }
  return new RuntimeTaskError("PROVIDER_REQUEST_FAILED", serializeErrorDetail(error), false);
}

function retryDelayMs(attempt: number): number {
  const base = 600 * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 250);
  return base + jitter;
}

async function ensureRuntimeSchema(env: RuntimeEnv): Promise<void> {
  if (runtimeSchemaReady) return;

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS agent_message (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS agent_result (
      agent_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      summary TEXT NOT NULL,
      commands TEXT NOT NULL,
      files_touched TEXT NOT NULL,
      violations TEXT NOT NULL,
      diff_summary TEXT,
      patch TEXT,
      commit_json TEXT,
      started_at INTEGER NOT NULL,
      finished_at INTEGER NOT NULL
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS agent_task (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      result_status TEXT,
      summary TEXT NOT NULL DEFAULT '',
      commands TEXT NOT NULL DEFAULT '[]',
      files_touched TEXT NOT NULL DEFAULT '[]',
      violations TEXT NOT NULL DEFAULT '[]',
      diff_summary TEXT,
      patch TEXT,
      commit_json TEXT,
      attempt INTEGER NOT NULL DEFAULT 0,
      request_id TEXT,
      error_code TEXT,
      error_detail TEXT,
      accepted_at INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      heartbeat_at INTEGER,
      finished_at INTEGER NOT NULL
    )
  `).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS agent_task_agent_id_idx ON agent_task (agent_id)`).run().catch(() => {});
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS agent_task_finished_at_idx ON agent_task (finished_at)`).run().catch(() => {});
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS agent_task_status_idx ON agent_task (status)`).run().catch(() => {});

  await env.DB.prepare(`ALTER TABLE agent_task ADD COLUMN result_status TEXT`).run().catch(() => {});
  await env.DB.prepare(`ALTER TABLE agent_task ADD COLUMN attempt INTEGER NOT NULL DEFAULT 0`).run().catch(() => {});
  await env.DB.prepare(`ALTER TABLE agent_task ADD COLUMN request_id TEXT`).run().catch(() => {});
  await env.DB.prepare(`ALTER TABLE agent_task ADD COLUMN error_code TEXT`).run().catch(() => {});
  await env.DB.prepare(`ALTER TABLE agent_task ADD COLUMN error_detail TEXT`).run().catch(() => {});
  await env.DB.prepare(`ALTER TABLE agent_task ADD COLUMN accepted_at INTEGER`).run().catch(() => {});
  await env.DB.prepare(`ALTER TABLE agent_task ADD COLUMN heartbeat_at INTEGER`).run().catch(() => {});
  await env.DB.prepare(`ALTER TABLE agent_task ADD COLUMN patch TEXT`).run().catch(() => {});
  await env.DB.prepare(`ALTER TABLE agent_result ADD COLUMN patch TEXT`).run().catch(() => {});

  await env.DB.prepare(`ALTER TABLE agent ADD COLUMN active_process_id TEXT`).run().catch(() => {});
  await env.DB.prepare(
    `ALTER TABLE agent ADD COLUMN cancel_requested INTEGER NOT NULL DEFAULT 0`,
  ).run().catch(() => {});

  runtimeSchemaReady = true;
}

function getBetterAuthSecret(env: RuntimeEnv): string | undefined {
  return resolveBetterAuthSecret({
    envSecret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
  });
}

function parseJsonArray(value: string): string[] {
  try {
    return JSON.parse(value) as string[];
  } catch {
    return [];
  }
}

function requireSandbox(env: RuntimeEnv): NonNullable<RuntimeEnv["Sandbox"]> {
  if (!env.Sandbox) {
    throw new RuntimeTaskError("SANDBOX_UNAVAILABLE", "Sandbox runtime is unavailable.");
  }
  return env.Sandbox;
}

function deriveRepoDirectoryName(repoUrl: string): string {
  const trimmed = repoUrl.trim().replace(/[#?].*$/, "").replace(/\/+$/, "");
  const lastSegment = trimmed.split("/").pop() || "";
  const withoutGitSuffix = lastSegment.replace(/\.git$/i, "");
  const safeName = withoutGitSuffix.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
  return safeName || "repo";
}

function resolveWorkspaceRoot(repoUrl?: string | null): string {
  if (!repoUrl) {
    return "/workspace";
  }
  return `/workspace/${deriveRepoDirectoryName(repoUrl)}`;
}

function extractAssistantText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (
          item &&
          typeof item === "object" &&
          "text" in item &&
          typeof (item as { text?: unknown }).text === "string"
        ) {
          return (item as { text: string }).text;
        }
        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

async function saveAgentMessage(
  env: RuntimeEnv,
  agentId: string,
  role: string,
  content: string,
): Promise<string> {
  await ensureRuntimeSchema(env);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO agent_message (id, agent_id, role, content, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(id, agentId, role, content, now()).run();
  return id;
}

async function loadAgentMessages(env: RuntimeEnv, agentId: string): Promise<MessageRow[]> {
  await ensureRuntimeSchema(env);
  const rows = await env.DB.prepare(
    `SELECT id, role, content, created_at
       FROM agent_message
      WHERE agent_id = ?
      ORDER BY created_at ASC`,
  ).bind(agentId).all<MessageRow>();
  return rows.results ?? [];
}

async function upsertAgentResultProjection(
  env: RuntimeEnv,
  agentId: string,
  result: AgentResult,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO agent_result
      (agent_id, status, summary, commands, files_touched, violations, diff_summary, patch, commit_json, started_at, finished_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(agent_id) DO UPDATE SET
      status = excluded.status,
      summary = excluded.summary,
      commands = excluded.commands,
      files_touched = excluded.files_touched,
      violations = excluded.violations,
      diff_summary = excluded.diff_summary,
      patch = excluded.patch,
      commit_json = excluded.commit_json,
      started_at = excluded.started_at,
      finished_at = excluded.finished_at`,
  ).bind(
    agentId,
    result.status,
    result.summary,
    JSON.stringify(result.commands),
    JSON.stringify(result.filesTouched),
    JSON.stringify(result.violations),
    result.diffSummary ?? null,
    result.patch ?? null,
    result.commit ? JSON.stringify(result.commit) : null,
    result.startedAt,
    result.finishedAt,
  ).run();
}

async function loadAgentResult(
  env: RuntimeEnv,
  agentId: string,
): Promise<AgentResult | null> {
  await ensureRuntimeSchema(env);

  const projectionRow = await env.DB.prepare(
    `SELECT status as result_status, summary, commands, files_touched, violations, diff_summary, patch, commit_json, started_at, finished_at
       FROM agent_result
      WHERE agent_id = ?
      LIMIT 1`,
  ).bind(agentId).first<ResultRow>();

  const row =
    projectionRow ??
    (await env.DB.prepare(
      `SELECT COALESCE(result_status, status) as result_status,
              summary, commands, files_touched, violations, diff_summary, patch, commit_json, started_at, finished_at
         FROM agent_task
        WHERE agent_id = ?
          AND (result_status IS NOT NULL OR status IN ('success', 'error', 'aborted', 'policy_error'))
        ORDER BY finished_at DESC
        LIMIT 1`,
    ).bind(agentId).first<ResultRow>());

  if (!row) return null;

  return {
    status: row.result_status,
    summary: row.summary,
    commands: JSON.parse(row.commands) as AgentResult["commands"],
    filesTouched: JSON.parse(row.files_touched) as string[],
    violations: JSON.parse(row.violations) as string[],
    diffSummary: row.diff_summary,
    patch: row.patch,
    commit: row.commit_json
      ? (JSON.parse(row.commit_json) as NonNullable<AgentResult["commit"]>)
      : null,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

async function setAgentStatus(
  env: RuntimeEnv,
  agentId: string,
  status: AgentStatusType,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE agent
        SET status = ?, updated_at = unixepoch('subsecond') * 1000
      WHERE id = ?`,
  ).bind(status, agentId).run();
}

async function updateAgentExecutionState(
  env: RuntimeEnv,
  agentId: string,
  updates: {
    status?: AgentStatusType;
    activeProcessId?: string | null;
    cancelRequested?: boolean;
  },
): Promise<void> {
  const clauses: string[] = [];
  const values: Array<string | number | null> = [];

  if (updates.status !== undefined) {
    clauses.push("status = ?");
    values.push(updates.status);
  }
  if (updates.activeProcessId !== undefined) {
    clauses.push("active_process_id = ?");
    values.push(updates.activeProcessId);
  }
  if (updates.cancelRequested !== undefined) {
    clauses.push("cancel_requested = ?");
    values.push(updates.cancelRequested ? 1 : 0);
  }

  clauses.push("updated_at = unixepoch('subsecond') * 1000");
  values.push(agentId);

  await env.DB.prepare(
    `UPDATE agent SET ${clauses.join(", ")} WHERE id = ?`,
  ).bind(...values).run();
}

async function getAgentExecutionState(
  env: RuntimeEnv,
  workspaceId: string,
  agentId: string,
): Promise<{
  status: AgentStatusType;
  activeProcessId: string | null;
  cancelRequested: boolean;
}> {
  await ensureRuntimeSchema(env);
  const row = await env.DB.prepare(
    `SELECT status, active_process_id, cancel_requested
       FROM agent
      WHERE id = ? AND workspace_id = ?
      LIMIT 1`,
  ).bind(agentId, workspaceId).first<{
    status: AgentStatusType;
    active_process_id: string | null;
    cancel_requested: number | null;
  }>();

  if (!row) {
    throw new RuntimeTaskError("AGENT_NOT_FOUND", `Agent ${agentId} not found.`);
  }

  return {
    status: row.status,
    activeProcessId: row.active_process_id,
    cancelRequested: Boolean(row.cancel_requested),
  };
}

async function getAgentTranscript(
  env: RuntimeEnv,
  agentId: string,
  limit = 12,
): Promise<string> {
  const messages = await loadAgentMessages(env, agentId);
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-limit)
    .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`)
    .join("\n\n");
}

async function buildTaskPrompt(
  env: RuntimeEnv,
  agentId: string,
  content: string,
): Promise<string> {
  const transcript = await getAgentTranscript(env, agentId, 12);
  return transcript
    ? [
        "Continue this filepath agent task from the transcript below.",
        "Reply only as the selected harness running in the sandbox.",
        "",
        transcript,
        "",
        "Respond to the latest human task in context.",
      ].join("\n")
    : content;
}

async function loadAgentExecutionConfig(
  env: RuntimeEnv,
  agentId: string,
  workspaceId: string,
  task: string,
): Promise<AgentExecutionConfig> {
  const row = await env.DB.prepare(
    `SELECT a.harness_id, a.model, a.allowed_paths, a.forbidden_paths,
            a.tool_permissions, a.writable_root, w.id as workspace_id, w.git_repo_url,
            u.openrouter_api_key as user_key, h.entry_command as entry_command
       FROM agent a
       JOIN workspace w ON a.workspace_id = w.id
       JOIN user u ON w.user_id = u.id
       JOIN harness h ON h.id = a.harness_id
      WHERE a.id = ? AND a.workspace_id = ?`,
  ).bind(agentId, workspaceId).first<{
    harness_id: string;
    model: string;
    allowed_paths: string;
    forbidden_paths: string;
    tool_permissions: string;
    writable_root: string | null;
    workspace_id: string;
    git_repo_url: string | null;
    user_key: string | null;
    entry_command: string;
  }>();

  if (!row) {
    throw new RuntimeTaskError("AGENT_NOT_FOUND", `Agent ${agentId} not found.`);
  }

  const provider = getProviderForModel(row.model);
  const providerDefinition = PROVIDERS[provider];
  let containerApiKey = "";
  const secret = getBetterAuthSecret(env);

  if (row.user_key && secret) {
    try {
      const decrypted = await decryptApiKey(row.user_key, secret);
      containerApiKey = deserializeStoredProviderKeys(decrypted)[provider] || "";
    } catch {
      throw new RuntimeTaskError(
        "PROVIDER_KEY_UNREADABLE",
        "Stored account router keys are unreadable. Re-save your account keys and try again.",
      );
    }
  }

  if (!containerApiKey) {
    throw new RuntimeTaskError(
      "PROVIDER_KEY_MISSING",
      `No valid API key available for the ${providerDefinition.label} router.`,
    );
  }

  const workspaceRoot = resolveWorkspaceRoot(row.git_repo_url);
  const policy = normalizeAgentScope({
    allowedPaths: parseJsonArray(row.allowed_paths),
    forbiddenPaths: parseJsonArray(row.forbidden_paths),
    toolPermissions: parseJsonArray(row.tool_permissions),
    writableRoot: row.writable_root,
  });
  const policyError = validateAgentScope(policy);
  if (policyError) {
    throw new RuntimeTaskError("POLICY_INVALID", policyError);
  }

  const executionRoot = resolveScopedWorkspaceRoot(workspaceRoot, policy.writableRoot);
  const envVars: Record<string, string> = {
    ...buildAgentEnv({
      harnessId: row.harness_id as HarnessId,
      model: canonicalizeStoredModel(row.model),
      apiKey: containerApiKey,
      task,
      workspacePath: workspaceRoot,
      allowedPaths: policy.allowedPaths,
      forbiddenPaths: policy.forbiddenPaths,
      toolPermissions: policy.toolPermissions,
      writableRoot: policy.writableRoot,
    }),
    FILEPATH_AGENT_ID: agentId,
    FILEPATH_WORKSPACE_ID: row.workspace_id,
  };

  if (!row.entry_command) {
    throw new RuntimeTaskError("HARNESS_ENTRY_COMMAND_MISSING", `Harness ${row.harness_id} has no entry command.`);
  }

  return {
    harnessId: row.harness_id,
    model: row.model,
    policy,
    workspaceId: row.workspace_id,
    gitRepoUrl: row.git_repo_url,
    entryCommand: row.entry_command,
    executionRoot,
    envVars,
  };
}

async function ensureContainer(
  env: RuntimeEnv,
  agentId: string,
  gitRepoUrl: string | null,
): Promise<Sandbox> {
  const sandboxEnv = requireSandbox(env);
  const { getSandbox } = await import("@cloudflare/sandbox");
  const { cloneRepo } = await import("$lib/agents/container");
  const sandbox = getSandbox(sandboxEnv as never, agentId);
  const workspaceRoot = resolveWorkspaceRoot(gitRepoUrl);

  if (gitRepoUrl) {
    const workspaceExists = await sandbox.exists(workspaceRoot);
    if (!workspaceExists.exists) {
      await cloneRepo(
        { Sandbox: sandboxEnv as never },
        agentId,
        gitRepoUrl,
        workspaceRoot,
      );
    }
  } else {
    await sandbox.mkdir(workspaceRoot, { recursive: true });
  }

  await env.DB.prepare(
    `UPDATE agent
        SET container_id = ?, updated_at = unixepoch('subsecond') * 1000
      WHERE id = ?`,
  ).bind(agentId, agentId).run();
  return sandbox;
}

async function ensureWorkspaceSandbox(
  env: RuntimeEnv,
  workspaceId: string,
  gitRepoUrl: string | null,
): Promise<Sandbox> {
  const sandboxEnv = requireSandbox(env);
  const { getSandbox } = await import("@cloudflare/sandbox");
  const { cloneRepo } = await import("$lib/agents/container");
  const sandboxId = `script-${workspaceId}`;
  const sandbox = getSandbox(sandboxEnv as never, sandboxId);
  const workspaceRoot = resolveWorkspaceRoot(gitRepoUrl);

  if (gitRepoUrl) {
    const workspaceExists = await sandbox.exists(workspaceRoot);
    if (!workspaceExists.exists) {
      await cloneRepo(
        { Sandbox: sandboxEnv as never },
        sandboxId,
        gitRepoUrl,
        workspaceRoot,
      );
    }
  } else {
    await sandbox.mkdir(workspaceRoot, { recursive: true });
  }

  return sandbox;
}

async function loadWorkspaceForScript(
  env: RuntimeEnv,
  workspaceId: string,
): Promise<{ gitRepoUrl: string | null }> {
  await ensureRuntimeSchema(env);
  const row = await env.DB.prepare(
    `SELECT git_repo_url FROM workspace WHERE id = ? LIMIT 1`,
  ).bind(workspaceId).first<{ git_repo_url: string | null }>();

  if (!row) {
    throw new RuntimeTaskError("WORKSPACE_NOT_FOUND", `Workspace ${workspaceId} not found.`);
  }

  return { gitRepoUrl: row.git_repo_url };
}

export interface ScriptRunResult {
  status: AgentResult["status"];
  summary: string;
  commands: AgentResult["commands"];
  filesTouched: string[];
  violations: string[];
  diffSummary: string | null;
  patch: string | null;
  commit: AgentResult["commit"];
  startedAt: number;
  finishedAt: number;
}

export async function runWorkspaceScript(
  env: RuntimeEnv,
  workspaceId: string,
  script: string,
  scopeInput?: {
    allowedPaths?: readonly string[];
    forbiddenPaths?: readonly string[];
    toolPermissions?: readonly string[];
    writableRoot?: string | null;
  },
): Promise<ScriptRunResult> {
  const trimmed = script.trim();
  if (!trimmed) {
    throw new RuntimeTaskError("SCRIPT_REQUIRED", "Script content is required.");
  }

  const { gitRepoUrl } = await loadWorkspaceForScript(env, workspaceId);
  const policy = normalizeAgentScope({
    allowedPaths: scopeInput?.allowedPaths ?? ["."],
    forbiddenPaths: scopeInput?.forbiddenPaths ?? [".git", "node_modules"],
    toolPermissions: scopeInput?.toolPermissions ?? ["search", "run", "write", "commit"],
    writableRoot: scopeInput?.writableRoot ?? ".",
  });
  const policyError = validateAgentScope(policy);
  if (policyError) {
    throw new RuntimeTaskError("POLICY_INVALID", policyError);
  }

  const sandbox = await ensureWorkspaceSandbox(env, workspaceId, gitRepoUrl);
  const workspaceRoot = resolveWorkspaceRoot(gitRepoUrl);
  const executionRoot = resolveScopedWorkspaceRoot(workspaceRoot, policy.writableRoot);
  await sandbox.mkdir(executionRoot, { recursive: true });

  const startedAt = now();
  const snapshotBase = `${workspaceRoot}/.filepath-script-${crypto.randomUUID()}`;
  const beforeSnapshotRoot = `${snapshotBase}/before`;
  const afterSnapshotRoot = `${snapshotBase}/after`;
  try {
    const beforeDirtyPaths = await collectWorkspaceDirtyPaths(sandbox, workspaceRoot);
    await writeScopedSnapshot(
      sandbox,
      workspaceRoot,
      beforeSnapshotRoot,
      policy.allowedPaths,
      policy.forbiddenPaths,
    );

    let result: { stdout: string; stderr: string; exitCode: number };
    try {
      const exec = await sandbox.exec(trimmed, { cwd: executionRoot });
      const exitCode = (exec as { code?: number; exitCode?: number })?.code
        ?? (exec as { code?: number; exitCode?: number })?.exitCode ?? 0;
      result = {
        stdout: (exec as { stdout?: string })?.stdout ?? "",
        stderr: (exec as { stderr?: string })?.stderr ?? "",
        exitCode,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result = { stdout: "", stderr: humanizeRuntimeFailureMessage(message), exitCode: 1 };
    }
    const finishedAt = now();
    await writeScopedSnapshot(
      sandbox,
      workspaceRoot,
      afterSnapshotRoot,
      policy.allowedPaths,
      policy.forbiddenPaths,
    );
    const afterDirtyPaths = await collectWorkspaceDirtyPaths(sandbox, workspaceRoot);
    const patch = await collectScopedWorkspacePatch(
      sandbox,
      workspaceRoot,
      beforeSnapshotRoot,
      afterSnapshotRoot,
    );
    const metadata = normalizeChangeMetadata({ patch });
    const violations = describeScopeViolations(
      policy,
      collectNewDirtyPaths(beforeDirtyPaths, afterDirtyPaths),
    );

    const status: AgentResult["status"] = violations.length > 0
      ? "policy_error"
      : result.exitCode === 0
        ? "success"
        : "error";
    const summary =
      violations.length > 0
        ? violations[0]
        : result.exitCode === 0
        ? (result.stdout.trim() || "Script completed.")
        : (result.stderr.trim() || result.stdout.trim() || "Script failed.");

    return {
      status,
      summary,
      commands: [{ command: trimmed, exitCode: result.exitCode }],
      filesTouched: violations.length > 0 ? [] : metadata.filesTouched,
      violations,
      diffSummary: violations.length > 0 ? null : metadata.diffSummary,
      patch: violations.length > 0 ? null : patch,
      commit: null,
      startedAt,
      finishedAt,
    };
  } finally {
    await sandbox.exec(`rm -rf ${quoteShell(snapshotBase)}`, {
      cwd: workspaceRoot,
    }).catch(() => {});
  }
}

function createExecRelay(): ExecRelay {
  let stdoutBuffer = "";
  let protocolError: RuntimeTaskError | null = null;
  const parsedEvents: AgentEventType[] = [];
  const rawStdoutLines: string[] = [];
  const stderrChunks: string[] = [];

  const handleLine = (line: string) => {
    if (protocolError) return;
    const trimmed = line.trim();
    if (trimmed.startsWith("{")) {
      const event = parseAgentEvent(trimmed);
      if (event) {
        parsedEvents.push(event);
      } else {
        protocolError = new RuntimeTaskError(
          "FAP_PROTOCOL_ERROR",
          `Invalid FAP event (schema validation failed): ${trimmed.slice(0, 200)}`,
        );
      }
    } else {
      rawStdoutLines.push(line);
    }
  };

  return {
    onOutput: (stream, data) => {
      if (stream === "stderr") {
        stderrChunks.push(data);
        return;
      }

      stdoutBuffer += data;
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) handleLine(trimmed);
      }
    },
    flush: () => {
      const trimmed = stdoutBuffer.trim();
      stdoutBuffer = "";
      if (trimmed) handleLine(trimmed);
    },
    checkProtocolError: () => {
      if (protocolError) throw protocolError;
    },
    events: () => parsedEvents,
    fallbackText: () => rawStdoutLines.join("\n").trim(),
    stderrSummary: () => stderrChunks.join("\n").trim(),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseLocalVerifyDirective(task: string): { delayMs: number; reply: string } | null {
  const match = task.trim().match(/^__filepath_local_wait__:(\d+)(?::([\s\S]+))?$/);
  if (!match) return null;

  const delayMs = Number.parseInt(match[1] ?? "0", 10);
  if (!Number.isFinite(delayMs) || delayMs < 0) return null;

  return {
    delayMs,
    reply: match[2]?.trim() || "LOCAL_WAIT_DONE",
  };
}

function buildAgentResultFromEvents(
  events: AgentEventType[],
  fallbackText: string,
  startedAt: number,
  finishedAt: number,
): AgentResult {
  const commands: AgentResult["commands"] = [];
  const filesTouched = new Set<string>();
  let summary = fallbackText.trim() || "Agent completed the task.";
  let commit: AgentResult["commit"] = null;
  let status: AgentResult["status"] = "success";

  for (const event of events) {
    if (event.type === "tool" && event.path) {
      filesTouched.add(event.path);
    }

    if (event.type === "command" && event.status !== "start") {
      commands.push({
        command: event.cmd,
        exitCode: event.exit ?? null,
      });
    }

    if (event.type === "commit") {
      commit = {
        sha: event.hash,
        message: event.message,
      };
    }

    if (event.type === "done" && event.summary) {
      summary = event.summary;
      status = "success";
    }

    if (event.type === "handoff") {
      summary = event.summary;
      status = "error";
    }
  }

  return {
    status,
    summary,
    commands,
    filesTouched: [...filesTouched],
    violations: [],
    diffSummary: null,
    patch: null,
    commit,
    startedAt,
    finishedAt,
  };
}

function quoteShell(value: string): string {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

function normalizePatchPathPrefix(path: string): string {
  return path.replace(/^\/+/, "").replace(/\/+$/, "");
}

function rewriteSnapshotPatchPaths(
  patch: string,
  beforeRoot: string,
  afterRoot: string,
): string {
  const beforePrefix = normalizePatchPathPrefix(beforeRoot);
  const afterPrefix = normalizePatchPathPrefix(afterRoot);

  return [
    [`a/${beforePrefix}/`, "a/"],
    [`b/${beforePrefix}/`, "b/"],
    [`a/${afterPrefix}/`, "a/"],
    [`b/${afterPrefix}/`, "b/"],
  ].reduce(
    (nextPatch, [from, to]) => nextPatch.split(from).join(to),
    patch,
  );
}

async function writeScopedSnapshot(
  sandbox: Sandbox,
  workspaceRoot: string,
  snapshotRoot: string,
  allowedPaths: readonly string[],
  forbiddenPaths: readonly string[],
): Promise<void> {
  const command = [
    "node <<'NODE'",
    "const fs = require('fs');",
    "const path = require('path');",
    `const workspaceRoot = ${JSON.stringify(workspaceRoot)};`,
    `const snapshotRoot = ${JSON.stringify(snapshotRoot)};`,
    `const allowedPaths = ${JSON.stringify([...allowedPaths])};`,
    `const forbiddenPaths = ${JSON.stringify([...forbiddenPaths])};`,
    "const normalize = (value) => value.replaceAll('\\\\', '/').replace(/^\\.\\//, '').replace(/\\/+$/, '');",
    "const matchesPrefix = (value, prefixes) => {",
    "  const normalizedValue = normalize(value);",
    "  if (prefixes.length === 0) return true;",
    "  return prefixes.some((prefix) => {",
    "    const normalizedPrefix = normalize(prefix);",
    "    if (!normalizedPrefix || normalizedPrefix === '.') return true;",
    "    return normalizedValue === normalizedPrefix || normalizedValue.startsWith(`${normalizedPrefix}/`);",
    "  });",
    "};",
    "const shouldCopy = (relativePath) => {",
    "  const normalizedPath = normalize(relativePath);",
    "  if (!matchesPrefix(normalizedPath, allowedPaths)) return false;",
    "  return !forbiddenPaths.some((prefix) => matchesPrefix(normalizedPath, [prefix]));",
    "};",
    "const ensureInsideWorkspace = (candidate) => {",
    "  const relativePath = normalize(path.relative(workspaceRoot, candidate));",
    "  if (relativePath === '' || (!relativePath.startsWith('../') && relativePath !== '..')) return;",
    "  throw new Error(`Scoped snapshot path escapes workspace: ${candidate}`);",
    "};",
    "const copyRecursive = (source, destination, relativePath) => {",
    "  ensureInsideWorkspace(source);",
    "  if (!shouldCopy(relativePath)) return;",
    "  const stat = fs.lstatSync(source);",
    "  if (stat.isDirectory()) {",
    "    fs.mkdirSync(destination, { recursive: true });",
    "    for (const entry of fs.readdirSync(source)) {",
    "      const childSource = path.join(source, entry);",
    "      const childDestination = path.join(destination, entry);",
    "      const childRelativePath = relativePath ? `${relativePath}/${entry}` : entry;",
    "      copyRecursive(childSource, childDestination, childRelativePath);",
    "    }",
    "    return;",
    "  }",
    "  fs.mkdirSync(path.dirname(destination), { recursive: true });",
    "  if (stat.isSymbolicLink()) {",
    "    const linkTarget = fs.readlinkSync(source);",
    "    try { fs.unlinkSync(destination); } catch {}",
    "    fs.symlinkSync(linkTarget, destination);",
    "    return;",
    "  }",
    "  fs.copyFileSync(source, destination);",
    "};",
    "fs.rmSync(snapshotRoot, { recursive: true, force: true });",
    "fs.mkdirSync(snapshotRoot, { recursive: true });",
    "const uniqueAllowedPaths = [...new Set(allowedPaths.map((value) => {",
    "  const normalized = normalize(value);",
    "  return normalized || '.';",
    "}))];",
    "for (const allowedPath of uniqueAllowedPaths) {",
    "  const relativePath = allowedPath === '.' ? '' : allowedPath;",
    "  const source = relativePath ? path.resolve(workspaceRoot, relativePath) : workspaceRoot;",
    "  ensureInsideWorkspace(source);",
    "  if (!fs.existsSync(source)) continue;",
    "  if (!relativePath) {",
    "    for (const entry of fs.readdirSync(source)) {",
    "      copyRecursive(path.join(source, entry), path.join(snapshotRoot, entry), entry);",
    "    }",
    "    continue;",
    "  }",
    "  copyRecursive(source, path.resolve(snapshotRoot, relativePath), relativePath);",
    "}",
    "NODE",
  ].join("\n");

  const result = await sandbox.exec(command, {
    cwd: workspaceRoot,
  }).catch(() => null);
  const exitCode = (result as { code?: number; exitCode?: number } | null)?.code
    ?? (result as { code?: number; exitCode?: number } | null)?.exitCode
    ?? null;

  if (!result || exitCode !== 0) {
    const stderr = (result as { stderr?: string } | null)?.stderr?.trim() || "unknown error";
    throw new RuntimeTaskError(
      "PATCH_SNAPSHOT_FAILED",
      `Could not snapshot scoped workspace state: ${stderr}`,
    );
  }
}

async function collectScopedWorkspacePatch(
  sandbox: Sandbox,
  workspaceRoot: string,
  beforeRoot: string,
  afterRoot: string,
): Promise<string | null> {
  const result = await sandbox.exec(
    `git diff --binary --no-index ${quoteShell(beforeRoot)} ${quoteShell(afterRoot)} || true`,
    {
      cwd: workspaceRoot,
    },
  ).catch(() => null);

  if (!result) {
    throw new RuntimeTaskError(
      "PATCH_COLLECTION_FAILED",
      "filepath could not derive a patch from the sandbox state.",
    );
  }

  const patch = ((result as { stdout?: string }).stdout ?? "").trim();
  if (!patch) {
    return null;
  }

  const rewritten = rewriteSnapshotPatchPaths(patch, beforeRoot, afterRoot).trim();
  return rewritten.length > 0 ? `${rewritten}\n` : null;
}

function parseNullSeparatedPaths(output: string): string[] {
  return output
    .split("\0")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function collectWorkspaceDirtyPaths(
  sandbox: Sandbox,
  workspaceRoot: string,
): Promise<Set<string>> {
  const commands = [
    "git diff --name-only -z",
    "git diff --cached --name-only -z",
    "git ls-files --others --exclude-standard -z",
  ];
  const dirtyPaths = new Set<string>();

  for (const command of commands) {
    const result = await sandbox.exec(command, {
      cwd: workspaceRoot,
    }).catch(() => null);

    if (!result) {
      continue;
    }

    const stdout = (result as { stdout?: string }).stdout ?? "";
    for (const path of parseNullSeparatedPaths(stdout)) {
      dirtyPaths.add(path);
    }
  }

  return dirtyPaths;
}

function collectNewDirtyPaths(before: ReadonlySet<string>, after: ReadonlySet<string>): string[] {
  return [...after].filter((path) => !before.has(path));
}

function describeScopeViolations(scope: AgentScope, changedPaths: readonly string[]): string[] {
  return changedPaths
    .filter((path) => !isPathAllowed(path, scope))
    .map((path) => `This run changed files outside scope: ${path}.`);
}

async function persistAssistantText(
  env: RuntimeEnv,
  agentId: string,
  events: AgentEventType[],
  fallbackText: string,
): Promise<void> {
  let saved = false;
  for (const event of events) {
    if (event.type === "text") {
      await saveAgentMessage(env, agentId, "assistant", event.content);
      saved = true;
    }
  }

  if (!saved && fallbackText.trim()) {
    await saveAgentMessage(env, agentId, "assistant", fallbackText.trim());
  }
}

async function stopContainer(env: RuntimeEnv, agentId: string): Promise<void> {
  await ensureRuntimeSchema(env);
  const row = await env.DB.prepare(
    `SELECT active_process_id
       FROM agent
      WHERE id = ?
      LIMIT 1`,
  ).bind(agentId).first<{ active_process_id: string | null }>();

  if (row?.active_process_id && row.active_process_id !== LOCAL_WAIT_PROCESS_ID) {
    const { getSandbox } = await import("@cloudflare/sandbox");
    const sandbox = getSandbox(requireSandbox(env) as never, agentId);
    await sandbox.killProcess(row.active_process_id).catch(() => {});
  }

  await updateAgentExecutionState(env, agentId, {
    activeProcessId: null,
    cancelRequested: false,
  });
}

async function insertQueuedTask(
  env: RuntimeEnv,
  agentId: string,
  content: string,
  requestId: string,
): Promise<AgentRuntimeActiveTask> {
  const taskId = crypto.randomUUID();
  const acceptedAt = now();
  await env.DB.prepare(
    `INSERT INTO agent_task
      (id, agent_id, content, status, result_status, summary, commands, files_touched, violations, diff_summary, patch, commit_json, attempt, request_id, error_code, error_detail, accepted_at, started_at, heartbeat_at, finished_at)
     VALUES (?, ?, ?, ?, NULL, '', '[]', '[]', '[]', NULL, NULL, NULL, 0, ?, NULL, NULL, ?, ?, ?, ?)`,
  ).bind(
    taskId,
    agentId,
    content,
    "queued",
    requestId,
    acceptedAt,
    acceptedAt,
    acceptedAt,
    acceptedAt,
  ).run();

  return {
    id: taskId,
    state: "queued",
    attempt: 0,
    requestId,
    acceptedAt,
    startedAt: null,
    heartbeatAt: acceptedAt,
    finishedAt: null,
    errorCode: null,
    errorDetail: null,
  };
}

async function patchTaskRow(
  env: RuntimeEnv,
  taskId: string,
  patch: {
    status?: AgentTaskState;
    resultStatus?: AgentResult["status"] | null;
    summary?: string;
    commands?: AgentResult["commands"];
    filesTouched?: string[];
    violations?: string[];
    diffSummary?: string | null;
    patchText?: string | null;
    commit?: AgentResult["commit"];
    attempt?: number;
    errorCode?: string | null;
    errorDetail?: string | null;
    acceptedAt?: number;
    startedAt?: number;
    heartbeatAt?: number | null;
    finishedAt?: number;
  },
): Promise<void> {
  const clauses: string[] = [];
  const values: Array<string | number | null> = [];

  if (patch.status !== undefined) {
    const current = await loadTaskRow(env, taskId);
    if (!current) {
      throw new RuntimeTaskError("TASK_NOT_FOUND", `Task ${taskId} not found.`);
    }
    const from = current.status as AgentTaskState;
    const to = patch.status;
    if (!isValidTaskTransition(from, to)) {
      throw new RuntimeTaskError(
        "INVALID_TASK_TRANSITION",
        `Invalid task transition from ${from} to ${to}.`,
      );
    }
    clauses.push("status = ?");
    values.push(patch.status);
  }
  if (patch.resultStatus !== undefined) {
    clauses.push("result_status = ?");
    values.push(patch.resultStatus);
  }
  if (patch.summary !== undefined) {
    clauses.push("summary = ?");
    values.push(patch.summary);
  }
  if (patch.commands !== undefined) {
    clauses.push("commands = ?");
    values.push(JSON.stringify(patch.commands));
  }
  if (patch.filesTouched !== undefined) {
    clauses.push("files_touched = ?");
    values.push(JSON.stringify(patch.filesTouched));
  }
  if (patch.violations !== undefined) {
    clauses.push("violations = ?");
    values.push(JSON.stringify(patch.violations));
  }
  if (patch.diffSummary !== undefined) {
    clauses.push("diff_summary = ?");
    values.push(patch.diffSummary);
  }
  if (patch.patchText !== undefined) {
    clauses.push("patch = ?");
    values.push(patch.patchText);
  }
  if (patch.commit !== undefined) {
    clauses.push("commit_json = ?");
    values.push(patch.commit ? JSON.stringify(patch.commit) : null);
  }
  if (patch.attempt !== undefined) {
    clauses.push("attempt = ?");
    values.push(patch.attempt);
  }
  if (patch.errorCode !== undefined) {
    clauses.push("error_code = ?");
    values.push(patch.errorCode);
  }
  if (patch.errorDetail !== undefined) {
    clauses.push("error_detail = ?");
    values.push(patch.errorDetail);
  }
  if (patch.acceptedAt !== undefined) {
    clauses.push("accepted_at = ?");
    values.push(patch.acceptedAt);
  }
  if (patch.startedAt !== undefined) {
    clauses.push("started_at = ?");
    values.push(patch.startedAt);
  }
  if (patch.heartbeatAt !== undefined) {
    clauses.push("heartbeat_at = ?");
    values.push(patch.heartbeatAt);
  }
  if (patch.finishedAt !== undefined) {
    clauses.push("finished_at = ?");
    values.push(patch.finishedAt);
  }

  if (clauses.length === 0) return;

  values.push(taskId);
  await env.DB.prepare(
    `UPDATE agent_task SET ${clauses.join(", ")} WHERE id = ?`,
  ).bind(...values).run();
}

async function loadTaskRow(
  env: RuntimeEnv,
  taskId: string,
): Promise<TaskRow | null> {
  await ensureRuntimeSchema(env);
  return env.DB.prepare(
    `SELECT id, agent_id, content, status, result_status, summary, commands, files_touched, violations,
            diff_summary, patch, commit_json, attempt, request_id, error_code, error_detail,
            accepted_at, started_at, heartbeat_at, finished_at
       FROM agent_task
      WHERE id = ?
      LIMIT 1`,
  ).bind(taskId).first<TaskRow>();
}

async function loadLatestActiveTaskRow(
  env: RuntimeEnv,
  agentId: string,
): Promise<TaskRow | null> {
  await ensureRuntimeSchema(env);
  return env.DB.prepare(
    `SELECT id, agent_id, content, status, result_status, summary, commands, files_touched, violations,
            diff_summary, patch, commit_json, attempt, request_id, error_code, error_detail,
            accepted_at, started_at, heartbeat_at, finished_at
       FROM agent_task
      WHERE agent_id = ?
        AND status IN ('queued', 'starting', 'running', 'retrying')
      ORDER BY COALESCE(accepted_at, started_at, finished_at) DESC
      LIMIT 1`,
  ).bind(agentId).first<TaskRow>();
}

function hydrateActiveTask(row: TaskRow): AgentRuntimeActiveTask {
  const state = isActiveTaskState(row.status) ? row.status : "running";
  return {
    id: row.id,
    state,
    attempt: row.attempt ?? 0,
    requestId: row.request_id ?? "",
    acceptedAt: row.accepted_at ?? row.started_at,
    startedAt: row.started_at || null,
    heartbeatAt: row.heartbeat_at ?? row.started_at ?? null,
    finishedAt: isTerminalTaskState(state) ? row.finished_at : null,
    errorCode: row.error_code,
    errorDetail: row.error_detail,
  };
}

async function heartbeatTask(
  env: RuntimeEnv,
  taskId: string,
  heartbeatAt = now(),
): Promise<void> {
  await patchTaskRow(env, taskId, { heartbeatAt });
}

async function buildFailureResult(
  summary: string,
  resultStatus: AgentResult["status"],
  startedAt: number,
  finishedAt: number,
  violations: string[] = [],
): Promise<AgentResult> {
  return {
    status: resultStatus,
    summary,
    commands: [],
    filesTouched: [],
    violations,
    diffSummary: null,
    patch: null,
    commit: null,
    startedAt,
    finishedAt,
  };
}

async function finalizeTaskOutcome(
  env: RuntimeEnv,
  params: {
    taskId: string;
    agentId: string;
    content: string;
    taskState: Extract<AgentTaskState, "succeeded" | "failed" | "canceled" | "stalled">;
    agentStatus: AgentStatusType;
    result: AgentResult;
    errorCode?: string | null;
    errorDetail?: string | null;
    persistAssistantSummary?: boolean;
  },
): Promise<AgentResult> {
  if (params.persistAssistantSummary) {
    await saveAgentMessage(env, params.agentId, "assistant", params.result.summary);
  }

  await patchTaskRow(env, params.taskId, {
    status: params.taskState,
    resultStatus: params.result.status,
    summary: params.result.summary,
    commands: params.result.commands,
    filesTouched: params.result.filesTouched,
    violations: params.result.violations,
    diffSummary: params.result.diffSummary ?? null,
    patchText: params.result.patch ?? null,
    commit: params.result.commit ?? null,
    errorCode: params.errorCode ?? null,
    errorDetail: params.errorDetail ?? null,
    heartbeatAt: params.result.finishedAt,
    finishedAt: params.result.finishedAt,
  });
  await upsertAgentResultProjection(env, params.agentId, params.result);
  await updateAgentExecutionState(env, params.agentId, {
    status: params.agentStatus,
    activeProcessId: null,
    cancelRequested: false,
  });
  return params.result;
}

async function finalizeTaskFailure(
  env: RuntimeEnv,
  params: {
    taskId: string;
    agentId: string;
    content: string;
    taskState: Extract<AgentTaskState, "failed" | "canceled" | "stalled">;
    runtimeStatus: AgentStatusType;
    resultStatus: AgentResult["status"];
    summary: string;
    errorCode: string;
    errorDetail?: string | null;
    startedAt?: number;
    violations?: string[];
  },
): Promise<AgentResult> {
  const startedAt = params.startedAt ?? (await loadTaskRow(env, params.taskId))?.started_at ?? now();
  const finishedAt = now();
  const result = await buildFailureResult(
    params.summary,
    params.resultStatus,
    startedAt,
    finishedAt,
    params.violations ?? [],
  );

  return finalizeTaskOutcome(env, {
    taskId: params.taskId,
    agentId: params.agentId,
    content: params.content,
    taskState: params.taskState,
    agentStatus: params.runtimeStatus,
    result,
    errorCode: params.errorCode,
    errorDetail: params.errorDetail ?? params.summary,
    persistAssistantSummary: true,
  });
}

async function setTaskState(
  env: RuntimeEnv,
  params: {
    taskId: string;
    agentId: string;
    state: Extract<AgentTaskState, "queued" | "starting" | "running" | "retrying">;
    attempt?: number;
    heartbeatAt?: number;
    startedAt?: number;
    processId?: string | null;
  },
): Promise<void> {
  const time = params.heartbeatAt ?? now();
  await patchTaskRow(env, params.taskId, {
    status: params.state,
    attempt: params.attempt,
    heartbeatAt: time,
    startedAt: params.startedAt,
    finishedAt: time,
  });
  await updateAgentExecutionState(env, params.agentId, {
    status: mapTaskStateToAgentStatus(params.state),
    activeProcessId: params.processId,
  });
}

async function ensureNotCancelled(
  env: RuntimeEnv,
  workspaceId: string,
  agentId: string,
): Promise<void> {
  const executionState = await getAgentExecutionState(env, workspaceId, agentId);
  if (executionState.cancelRequested) {
    throw new RuntimeTaskError("TASK_CANCELED", "The agent task was cancelled.");
  }
}

async function maybeMarkStalledTask(
  env: RuntimeEnv,
  workspaceId: string,
  agentId: string,
): Promise<void> {
  const activeTask = await loadLatestActiveTaskRow(env, agentId);
  if (!activeTask || !isActiveTaskState(activeTask.status)) return;

  const heartbeatAt = activeTask.heartbeat_at ?? activeTask.started_at ?? activeTask.accepted_at ?? now();
  const staleThreshold = activeTask.status === "starting" ? STARTING_STALE_MS : RUNNING_STALE_MS;

  if (now() - heartbeatAt <= staleThreshold) return;

  await finalizeTaskFailure(env, {
    taskId: activeTask.id,
    agentId,
    content: activeTask.content,
    taskState: "stalled",
    runtimeStatus: "stalled",
    resultStatus: "error",
    summary: "The agent task stalled before it finished.",
    errorCode: "TASK_STALLED",
    errorDetail: `No heartbeat recorded since ${heartbeatAt}.`,
    startedAt: activeTask.started_at,
  });
}

async function getActiveTaskSnapshot(
  env: RuntimeEnv,
  workspaceId: string,
  agentId: string,
): Promise<AgentRuntimeActiveTask | null> {
  await maybeMarkStalledTask(env, workspaceId, agentId);
  const row = await loadLatestActiveTaskRow(env, agentId);
  if (!row || !isActiveTaskState(row.status)) return null;
  return hydrateActiveTask(row);
}

async function runDirectModelTask(
  config: AgentExecutionConfig,
  task: string,
): Promise<DirectModelResponse> {
  const provider = getProviderForModel(config.model);
  const providerDefinition = PROVIDERS[provider];

  let response: Response;
  try {
    response = await fetch(providerDefinition.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.envVars.FILEPATH_API_KEY}`,
        ...(providerDefinition.defaultHeaders ?? {}),
      },
      body: JSON.stringify({
        model: normalizeModelForProvider(config.model),
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              HARNESS_SYSTEM_PROMPTS[config.harnessId] ??
              `You are the ${config.harnessId} filepath harness. Respond directly to the latest user task.`,
          },
          {
            role: "user",
            content: task,
          },
        ],
      }),
    });
  } catch (error) {
    throw new RuntimeTaskError(
      "PROVIDER_NETWORK_ERROR",
      `${providerDefinition.label} request failed: ${serializeErrorDetail(error)}`,
      true,
    );
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    const retryable = response.status === 429 || response.status >= 500;
    throw new RuntimeTaskError(
      retryable ? "PROVIDER_RETRYABLE" : "PROVIDER_REQUEST_FAILED",
      `${providerDefinition.label} request failed (${response.status}): ${errorBody.slice(0, 400) || response.statusText}`,
      retryable,
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        choices?: Array<{
          message?: { content?: unknown };
        }>;
      }
    | null;

  const assistantText = extractAssistantText(payload?.choices?.[0]?.message?.content);
  if (!assistantText) {
    throw new RuntimeTaskError(
      "PROVIDER_EMPTY_RESPONSE",
      `${providerDefinition.label} response did not include assistant text.`,
    );
  }

  return {
    assistantText,
    summary: "Agent completed the task.",
  };
}

async function runLocalWaitTask(
  env: RuntimeEnv,
  workspaceId: string,
  taskId: string,
  agentId: string,
  content: string,
  directive: { delayMs: number; reply: string },
  logContext: Omit<TaskLogContext, "phase">,
): Promise<AgentTaskCompletion> {
  const startedAt = now();
  await setTaskState(env, {
    taskId,
    agentId,
    state: "running",
    startedAt,
    heartbeatAt: startedAt,
    processId: LOCAL_WAIT_PROCESS_ID,
  });

  const deadline = startedAt + directive.delayMs;
  let lastHeartbeat = startedAt;
  while (now() < deadline) {
    await ensureNotCancelled(env, workspaceId, agentId);
    if (now() - lastHeartbeat >= 1_000) {
      lastHeartbeat = now();
      await heartbeatTask(env, taskId, lastHeartbeat);
    }
    await sleep(250);
  }

  const finishedAt = now();
  await saveAgentMessage(env, agentId, "assistant", directive.reply);
  const result: AgentResult = {
    status: "success",
    summary: "Agent completed the local verification task.",
    commands: [],
    filesTouched: [],
    violations: [],
    diffSummary: null,
    patch: null,
    commit: null,
    startedAt,
    finishedAt,
  };
  await finalizeTaskOutcome(env, {
    taskId,
    agentId,
    content,
    taskState: "succeeded",
    agentStatus: "done",
    result,
  });
  logTaskEvent("log", {
    ...logContext,
    phase: "task.exec_finished",
    attempt: 0,
    durationMs: finishedAt - startedAt,
    state: "succeeded",
  });
  logTaskEvent("log", {
    ...logContext,
    phase: "task.result_saved",
    attempt: 0,
    durationMs: finishedAt - startedAt,
    state: "succeeded",
  });
  return { result, events: [] };
}

async function runDirectExecutionTask(
  env: RuntimeEnv,
  workspaceId: string,
  taskId: string,
  agentId: string,
  content: string,
  taskPrompt: string,
  config: AgentExecutionConfig,
  logBase: Omit<TaskLogContext, "phase">,
): Promise<AgentTaskCompletion> {
  const startedAt = now();
  await setTaskState(env, {
    taskId,
    agentId,
    state: "running",
    attempt: 0,
    startedAt,
    heartbeatAt: startedAt,
    processId: null,
  });
  logTaskEvent("log", {
    ...logBase,
    harnessId: config.harnessId,
    model: config.model,
    phase: "task.exec_started",
    attempt: 0,
    state: "running",
  });

  for (let attempt = 0; attempt <= TASK_RETRY_LIMIT; attempt += 1) {
    await ensureNotCancelled(env, workspaceId, agentId);
    await patchTaskRow(env, taskId, { attempt, heartbeatAt: now() });
    try {
      const response = await runDirectModelTask(config, taskPrompt);
      await ensureNotCancelled(env, workspaceId, agentId);
      const finishedAt = now();
      await saveAgentMessage(env, agentId, "assistant", response.assistantText);
      const result: AgentResult = {
        status: "success",
        summary: response.summary,
        commands: [],
        filesTouched: [],
        violations: [],
        diffSummary: null,
        patch: null,
        commit: null,
        startedAt,
        finishedAt,
      };
      await finalizeTaskOutcome(env, {
        taskId,
        agentId,
        content,
        taskState: "succeeded",
        agentStatus: "done",
        result,
      });
      logTaskEvent("log", {
        ...logBase,
        harnessId: config.harnessId,
        model: config.model,
        phase: "task.exec_finished",
        attempt,
        durationMs: finishedAt - startedAt,
        state: "succeeded",
      });
      logTaskEvent("log", {
        ...logBase,
        harnessId: config.harnessId,
        model: config.model,
        phase: "task.result_saved",
        attempt,
        durationMs: finishedAt - startedAt,
        state: "succeeded",
      });
      return { result, events: [] };
    } catch (error) {
      const runtimeError = classifyProviderError(error);
      if (runtimeError.code === "TASK_CANCELED") {
        break;
      }
      if (runtimeError.retryable && attempt < TASK_RETRY_LIMIT) {
        const delayMs = retryDelayMs(attempt);
        await setTaskState(env, {
          taskId,
          agentId,
          state: "retrying",
          attempt: attempt + 1,
          heartbeatAt: now(),
          processId: null,
        });
        logTaskEvent("warn", {
          ...logBase,
          harnessId: config.harnessId,
          model: config.model,
          phase: "task.retrying",
          attempt: attempt + 1,
          durationMs: delayMs,
          state: "retrying",
          errorCode: runtimeError.code,
          errorDetail: runtimeError.message,
        });
        await sleep(delayMs);
        await setTaskState(env, {
          taskId,
          agentId,
          state: "running",
          attempt: attempt + 1,
          heartbeatAt: now(),
          processId: null,
        });
        continue;
      }

      const failed = await finalizeTaskFailure(env, {
        taskId,
        agentId,
        content,
        taskState: "failed",
        runtimeStatus: "error",
        resultStatus: "error",
        summary: `The local development runtime failed while handling this task: ${runtimeError.message}`,
        errorCode: runtimeError.code,
        errorDetail: runtimeError.message,
        startedAt,
      });
      logTaskEvent("error", {
        ...logBase,
        harnessId: config.harnessId,
        model: config.model,
        phase: "task.failed",
        attempt,
        durationMs: failed.finishedAt - startedAt,
        state: "failed",
        errorCode: runtimeError.code,
        errorDetail: runtimeError.message,
      });
      return { result: failed, events: [] };
    }
  }

  const canceled = await finalizeTaskFailure(env, {
    taskId,
    agentId,
    content,
    taskState: "canceled",
    runtimeStatus: "idle",
    resultStatus: "aborted",
    summary: "The agent task was cancelled.",
    errorCode: "TASK_CANCELED",
    startedAt,
  });
  logTaskEvent("warn", {
    ...logBase,
    harnessId: config.harnessId,
    model: config.model,
    phase: "task.canceled",
    durationMs: canceled.finishedAt - startedAt,
    state: "canceled",
    errorCode: "TASK_CANCELED",
    errorDetail: canceled.summary,
  });
  return { result: canceled, events: [] };
}

async function withSandboxStartupRetry<T>(
  env: RuntimeEnv,
  taskId: string,
  agentId: string,
  logBase: Omit<TaskLogContext, "phase">,
  work: (attempt: number) => Promise<T>,
): Promise<T> {
  let lastError: RuntimeTaskError | null = null;

  for (let attempt = 0; attempt <= TASK_RETRY_LIMIT; attempt += 1) {
    try {
      return await work(attempt);
    } catch (error) {
      const runtimeError = classifySandboxStartupError(error);
      lastError = runtimeError;
      if (!runtimeError.retryable || attempt >= TASK_RETRY_LIMIT) {
        throw runtimeError;
      }

      const delayMs = retryDelayMs(attempt);
      await setTaskState(env, {
        taskId,
        agentId,
        state: "retrying",
        attempt: attempt + 1,
        heartbeatAt: now(),
        processId: null,
      });
      logTaskEvent("warn", {
        ...logBase,
        phase: "task.retrying",
        attempt: attempt + 1,
        durationMs: delayMs,
        state: "retrying",
        errorCode: runtimeError.code,
        errorDetail: runtimeError.message,
      });
      await sleep(delayMs);
      await setTaskState(env, {
        taskId,
        agentId,
        state: "starting",
        attempt: attempt + 1,
        heartbeatAt: now(),
        processId: null,
      });
    }
  }

  throw lastError ?? new RuntimeTaskError("SANDBOX_START_FAILED", "Sandbox failed to start.");
}

async function runSandboxTask(
  env: RuntimeEnv,
  workspaceId: string,
  taskId: string,
  agentId: string,
  content: string,
  config: AgentExecutionConfig,
  logBase: Omit<TaskLogContext, "phase">,
): Promise<AgentTaskCompletion> {
  const processId = `task-${taskId}`;
  const startedAt = now();
  const workspaceRoot = resolveWorkspaceRoot(config.gitRepoUrl);
  const snapshotBase = `/tmp/filepath-task-snapshots/${taskId}`;
  const beforeSnapshotRoot = `${snapshotBase}/before`;
  const afterSnapshotRoot = `${snapshotBase}/after`;
  let process: Process | null = null;
  let sandbox: Sandbox | null = null;
  let beforeDirtyPaths = new Set<string>();

  try {
    sandbox = await withSandboxStartupRetry(env, taskId, agentId, {
      ...logBase,
      harnessId: config.harnessId,
      model: config.model,
    }, async () => {
      await ensureNotCancelled(env, workspaceId, agentId);
      const nextSandbox = await ensureContainer(env, agentId, config.gitRepoUrl);
      await nextSandbox.mkdir(config.executionRoot, { recursive: true });
      return nextSandbox;
    });
    await writeScopedSnapshot(
      sandbox,
      workspaceRoot,
      beforeSnapshotRoot,
      config.policy.allowedPaths,
      config.policy.forbiddenPaths,
    );
    beforeDirtyPaths = await collectWorkspaceDirtyPaths(sandbox, workspaceRoot);
  } catch (error) {
    const runtimeError = classifySandboxStartupError(error);
    const failed = await finalizeTaskFailure(env, {
      taskId,
      agentId,
      content,
      taskState: "failed",
      runtimeStatus: "error",
      resultStatus: "error",
      summary: `Could not start the agent sandbox: ${runtimeError.message}`,
      errorCode: runtimeError.code,
      errorDetail: runtimeError.message,
      startedAt,
    });
    logTaskEvent("error", {
      ...logBase,
      harnessId: config.harnessId,
      model: config.model,
      phase: "task.failed",
      durationMs: failed.finishedAt - startedAt,
      state: "failed",
      errorCode: runtimeError.code,
      errorDetail: runtimeError.message,
    });
    return { result: failed, events: [] };
  }

  const relay = createExecRelay();
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  try {
    await setTaskState(env, {
      taskId,
      agentId,
      state: "running",
      attempt: 0,
      startedAt,
      heartbeatAt: now(),
      processId,
    });
    logTaskEvent("log", {
      ...logBase,
      harnessId: config.harnessId,
      model: config.model,
      phase: "task.container_ready",
      attempt: 0,
      state: "running",
    });

    process = await sandbox.startProcess(config.entryCommand, {
      cwd: config.executionRoot,
      env: config.envVars,
      processId,
      autoCleanup: true,
      onOutput: relay.onOutput,
    });

    await updateAgentExecutionState(env, agentId, {
      activeProcessId: process.id,
      status: "running",
      cancelRequested: false,
    });

    logTaskEvent("log", {
      ...logBase,
      harnessId: config.harnessId,
      model: config.model,
      phase: "task.exec_started",
      attempt: 0,
      processId: process.id,
      state: "running",
    });

    heartbeatTimer = setInterval(() => {
      void heartbeatTask(env, taskId).catch(() => {});
    }, 2_000);

    const waitResult = await process.waitForExit();
    relay.flush();
    relay.checkProtocolError();
    const exitCode = waitResult.exitCode;
    const logs = await process.getLogs().catch(() => ({ stdout: "", stderr: "" }));
    if (logs.stdout) relay.onOutput("stdout", logs.stdout);
    if (logs.stderr) relay.onOutput("stderr", logs.stderr);
    relay.flush();
    relay.checkProtocolError();

    await ensureNotCancelled(env, workspaceId, agentId);

    if (exitCode !== 0) {
      const stderrSummary = relay.stderrSummary().trim() || logs.stderr.trim();
      throw new RuntimeTaskError(
        "SANDBOX_EXEC_FAILED",
        stderrSummary
          ? `Sandbox command failed (${exitCode}): ${stderrSummary}`
          : `Sandbox command failed (${exitCode}).`,
      );
    }

    const policyViolation = getRuntimePolicyViolation(config.policy, relay.events());
    if (policyViolation) {
      throw new RuntimeTaskError("POLICY_VIOLATION", policyViolation);
    }

    await persistAssistantText(env, agentId, relay.events(), relay.fallbackText());
    const finishedAt = now();
    const result = buildAgentResultFromEvents(
      relay.events(),
      relay.fallbackText(),
      startedAt,
      finishedAt,
    );
    await writeScopedSnapshot(
      sandbox,
      workspaceRoot,
      afterSnapshotRoot,
      config.policy.allowedPaths,
      config.policy.forbiddenPaths,
    );
    result.patch = await collectScopedWorkspacePatch(
      sandbox,
      workspaceRoot,
      beforeSnapshotRoot,
      afterSnapshotRoot,
    );
    const normalizedChangeMetadata = normalizeChangeMetadata({ patch: result.patch });
    const afterDirtyPaths = await collectWorkspaceDirtyPaths(sandbox, workspaceRoot);
    const scopeViolations = describeScopeViolations(
      config.policy,
      collectNewDirtyPaths(beforeDirtyPaths, afterDirtyPaths),
    );
    if (scopeViolations.length > 0) {
      throw new RuntimeTaskError("POLICY_VIOLATION", scopeViolations[0]);
    }
    if (!result.patch && !result.commit && hasWriteIntentEvents(relay.events())) {
      throw new RuntimeTaskError(
        "PATCH_MISSING",
        "The task reported file edits, but filepath could not derive a patch from the bounded run.",
      );
    }
    result.filesTouched = normalizedChangeMetadata.filesTouched;
    result.diffSummary = normalizedChangeMetadata.diffSummary;
    const terminalStatus = relay.events().some((event) => event.type === "handoff")
      ? "exhausted"
      : "done";

    await finalizeTaskOutcome(env, {
      taskId,
      agentId,
      content,
      taskState: "succeeded",
      agentStatus: terminalStatus,
      result,
    });

    logTaskEvent("log", {
      ...logBase,
      harnessId: config.harnessId,
      model: config.model,
      phase: "task.exec_finished",
      attempt: 0,
      durationMs: finishedAt - startedAt,
      processId: process.id,
      state: "succeeded",
    });
    logTaskEvent("log", {
      ...logBase,
      harnessId: config.harnessId,
      model: config.model,
      phase: "task.result_saved",
      attempt: 0,
      durationMs: finishedAt - startedAt,
      processId: process.id,
      state: "succeeded",
    });
    return { result, events: relay.events() };
  } catch (error) {
    const runtimeError = toRuntimeTaskError(
      error,
      "SANDBOX_EXEC_FAILED",
      "The sandbox runtime failed while handling this task.",
    );
    const executionState = await getAgentExecutionState(env, workspaceId, agentId).catch(() => ({
      status: "error" as AgentStatusType,
      activeProcessId: null,
      cancelRequested: false,
    }));
    const canceled = runtimeError.code === "TASK_CANCELED" || executionState.cancelRequested;
    const policy = runtimeError.code === "POLICY_VIOLATION";
    const taskState: Extract<AgentTaskState, "failed" | "canceled"> = canceled ? "canceled" : "failed";
    const runtimeStatus: AgentStatusType = canceled ? "idle" : "error";
    const resultStatus: AgentResult["status"] = canceled
      ? "aborted"
      : policy
        ? "policy_error"
        : "error";
    const summary = canceled
      ? "The agent task was cancelled."
      : policy
        ? runtimeError.message
        : `The sandbox runtime failed while handling this task: ${runtimeError.message}`;
    const failed = await finalizeTaskFailure(env, {
      taskId,
      agentId,
      content,
      taskState,
      runtimeStatus,
      resultStatus,
      summary,
      errorCode: runtimeError.code,
      errorDetail: runtimeError.message,
      startedAt,
      violations: policy ? [runtimeError.message] : [],
    });
    logTaskEvent(canceled ? "warn" : "error", {
      ...logBase,
      harnessId: config.harnessId,
      model: config.model,
      phase: canceled ? "task.canceled" : "task.failed",
      attempt: 0,
      durationMs: failed.finishedAt - startedAt,
      processId: process?.id ?? null,
      state: taskState,
      errorCode: runtimeError.code,
      errorDetail: runtimeError.message,
    });
    return { result: failed, events: [] };
  } finally {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
    await sandbox?.exec(`rm -rf ${quoteShell(snapshotBase)}`, {
      cwd: workspaceRoot,
    }).catch(() => {});
    await updateAgentExecutionState(env, agentId, {
      activeProcessId: null,
      cancelRequested: false,
    });
  }
}

export async function processAcceptedAgentTask(
  env: RuntimeEnv,
  workspaceId: string,
  agentId: string,
  taskId: string,
  content: string,
  requestId: string,
): Promise<AgentTaskCompletion> {
  const acceptedAt = now();
  const persistedTask = await loadTaskRow(env, taskId);
  if (!persistedTask) {
    throw new RuntimeTaskError("TASK_NOT_FOUND", `Task ${taskId} not found.`);
  }
  if (isTerminalTaskState(persistedTask.status)) {
    const result =
      (await loadAgentResult(env, agentId)) ??
      {
        status: (persistedTask.result_status ?? "aborted") as AgentResult["status"],
        summary: persistedTask.summary || "The task is already finished.",
        commands: [],
        filesTouched: [],
        violations: [],
        diffSummary: null,
        patch: null,
        commit: null,
        startedAt: persistedTask.started_at,
        finishedAt: persistedTask.finished_at,
      };
    return { result, events: [] };
  }

  logTaskEvent("log", {
    requestId,
    taskId,
    workspaceId,
    agentId,
    phase: "task.starting",
    attempt: 0,
    state: "starting",
  });

  const localWaitDirective = env.BETTER_AUTH_URL?.startsWith("http://localhost")
    ? parseLocalVerifyDirective(content)
    : null;

  try {
    await ensureNotCancelled(env, workspaceId, agentId);
    await setTaskState(env, {
      taskId,
      agentId,
      state: "starting",
      attempt: 0,
      startedAt: acceptedAt,
      heartbeatAt: acceptedAt,
      processId: localWaitDirective ? LOCAL_WAIT_PROCESS_ID : null,
    });

    if (localWaitDirective) {
      return await runLocalWaitTask(
        env,
        workspaceId,
        taskId,
        agentId,
        content,
        localWaitDirective,
        { requestId, taskId, workspaceId, agentId },
      );
    }

    const taskPrompt = await buildTaskPrompt(env, agentId, content);
    const config = await loadAgentExecutionConfig(env, agentId, workspaceId, taskPrompt);

    logTaskEvent("log", {
      requestId,
      taskId,
      workspaceId,
      agentId,
      harnessId: config.harnessId,
      model: config.model,
      phase: "task.config_loaded",
      attempt: 0,
      state: "starting",
    });

    if (!env.Sandbox) {
      return await runDirectExecutionTask(
        env,
        workspaceId,
        taskId,
        agentId,
        content,
        taskPrompt,
        config,
        { requestId, taskId, workspaceId, agentId },
      );
    }

    return await runSandboxTask(
      env,
      workspaceId,
      taskId,
      agentId,
      content,
      config,
      { requestId, taskId, workspaceId, agentId },
    );
  } catch (error) {
    const runtimeError = toRuntimeTaskError(
      error,
      "TASK_START_FAILED",
      "Could not start the agent task.",
    );
    const canceled = runtimeError.code === "TASK_CANCELED";
    const taskState: Extract<AgentTaskState, "failed" | "canceled"> = canceled ? "canceled" : "failed";
    const runtimeStatus: AgentStatusType = canceled ? "idle" : "error";
    const resultStatus: AgentResult["status"] = canceled ? "aborted" : "error";
    const summary = canceled
      ? "The agent task was cancelled."
      : `Could not start the agent task: ${runtimeError.message}`;
    const result = await finalizeTaskFailure(env, {
      taskId,
      agentId,
      content,
      taskState,
      runtimeStatus,
      resultStatus,
      summary,
      errorCode: runtimeError.code,
      errorDetail: runtimeError.message,
      startedAt: acceptedAt,
    });
    logTaskEvent(canceled ? "warn" : "error", {
      requestId,
      taskId,
      workspaceId,
      agentId,
      phase: canceled ? "task.canceled" : "task.validation_failed",
      attempt: 0,
      durationMs: result.finishedAt - acceptedAt,
      state: taskState,
      errorCode: runtimeError.code,
      errorDetail: runtimeError.message,
    });
    return { result, events: [] };
  }
}

export async function acceptAgentTask(
  env: RuntimeEnv,
  workspaceId: string,
  agentId: string,
  content: string,
  requestId: string = crypto.randomUUID(),
): Promise<AgentTaskAcceptedResponse> {
  await ensureRuntimeSchema(env);
  await maybeMarkStalledTask(env, workspaceId, agentId);
  const currentState = await getAgentExecutionState(env, workspaceId, agentId);

  if (currentState.status === "exhausted") {
    throw new RuntimeTaskError(
      "AGENT_EXHAUSTED",
      "This agent is exhausted and read-only.",
    );
  }

  const activeTask = await loadLatestActiveTaskRow(env, agentId);
  if (activeTask && isActiveTaskState(activeTask.status)) {
    throw new RuntimeTaskError(
      "TASK_ALREADY_RUNNING",
      "This agent is already processing a task. Wait for it to finish.",
    );
  }

  await saveAgentMessage(env, agentId, "user", content);
  const task = await insertQueuedTask(env, agentId, content, requestId);
  await updateAgentExecutionState(env, agentId, {
    status: "queued",
    activeProcessId: null,
    cancelRequested: false,
  });
  logTaskEvent("log", {
    requestId,
    taskId: task.id,
    workspaceId,
    agentId,
    phase: "task.accepted",
    attempt: 0,
    state: "queued",
  });

  return {
    ok: true,
    taskId: task.id,
    state: "queued",
  };
}

export function scheduleAcceptedAgentTask(
  env: RuntimeEnv,
  ctx: RuntimeExecutionContext | null,
  params: {
    workspaceId: string;
    agentId: string;
    taskId: string;
    content: string;
    requestId: string;
  },
): void {
  const run = processAcceptedAgentTask(
    env,
    params.workspaceId,
    params.agentId,
    params.taskId,
    params.content,
    params.requestId,
  ).catch((error) => {
    logTaskEvent("error", {
      requestId: params.requestId,
      taskId: params.taskId,
      workspaceId: params.workspaceId,
      agentId: params.agentId,
      phase: "task.failed",
      errorCode: "UNHANDLED_RUNTIME_ERROR",
      errorDetail: serializeErrorDetail(error),
    });
  });

  if (ctx) {
    ctx.waitUntil(run);
    return;
  }

  void run;
}

export async function getAgentRuntimeSnapshot(
  env: RuntimeEnv,
  workspaceId: string,
  agentId: string,
): Promise<AgentRuntimeSnapshot> {
  const activeTask = await getActiveTaskSnapshot(env, workspaceId, agentId);
  const executionState = await getAgentExecutionState(env, workspaceId, agentId);
  const messages = await loadAgentMessages(env, agentId);
  const result = await loadAgentResult(env, agentId);

  return {
    status: executionState.status,
    activeProcessId: executionState.activeProcessId,
    activeTask,
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.created_at,
    })),
    result,
  };
}

export async function cancelAgentTask(
  env: RuntimeEnv,
  workspaceId: string,
  agentId: string,
): Promise<{ cancelled: boolean; taskId: string | null }> {
  await ensureRuntimeSchema(env);
  await maybeMarkStalledTask(env, workspaceId, agentId);
  const activeTask = await loadLatestActiveTaskRow(env, agentId);
  if (!activeTask || !isActiveTaskState(activeTask.status)) {
    return { cancelled: false, taskId: null };
  }

  await updateAgentExecutionState(env, agentId, {
    cancelRequested: true,
  });

  if (activeTask.status === "queued") {
    await finalizeTaskFailure(env, {
      taskId: activeTask.id,
      agentId,
      content: activeTask.content,
      taskState: "canceled",
      runtimeStatus: "idle",
      resultStatus: "aborted",
      summary: "The agent task was cancelled.",
      errorCode: "TASK_CANCELED",
      startedAt: activeTask.started_at,
    });
    return { cancelled: true, taskId: activeTask.id };
  }

  const executionState = await getAgentExecutionState(env, workspaceId, agentId);
  if (executionState.activeProcessId && executionState.activeProcessId !== LOCAL_WAIT_PROCESS_ID) {
    const { getSandbox } = await import("@cloudflare/sandbox");
    const sandbox = getSandbox(requireSandbox(env) as never, agentId);
    await sandbox.killProcess(executionState.activeProcessId).catch(() => {});
  }

  await heartbeatTask(env, activeTask.id);
  return { cancelled: true, taskId: activeTask.id };
}

export async function deleteAgentRuntime(
  env: RuntimeEnv,
  agentId: string,
): Promise<void> {
  await stopContainer(env, agentId);
  await ensureRuntimeSchema(env);
  await env.DB.prepare(`DELETE FROM agent_message WHERE agent_id = ?`).bind(agentId).run();
  await env.DB.prepare(`DELETE FROM agent_task WHERE agent_id = ?`).bind(agentId).run();
  await env.DB.prepare(`DELETE FROM agent_result WHERE agent_id = ?`).bind(agentId).run();
}
