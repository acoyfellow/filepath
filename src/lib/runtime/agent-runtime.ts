import { getSandbox, type Sandbox } from "@cloudflare/sandbox";
import { parseAgentEvent } from "$lib/protocol";
import type { AgentEventType, AgentStatusType } from "$lib/protocol";
import { buildAgentEnv } from "$lib/agents/adapters";
import { resolveWorkspaceRoot, cloneRepo, type ContainerEnv } from "$lib/agents/container";
import type { HarnessId, AgentResult, AgentRuntimeSnapshot } from "$lib/types/workspace";
import {
  getRuntimePolicyViolation,
  normalizeNodeRuntimePolicy,
  resolveScopedWorkspaceRoot,
  validateNodeRuntimePolicy,
  type NodeRuntimePolicy,
} from "$lib/runtime/authority";
import { decryptApiKey } from "$lib/crypto";
import { resolveBetterAuthSecret } from "$lib/better-auth-secret";
import {
  canonicalizeStoredModel,
  deserializeStoredProviderKeys,
  getProviderForModel,
  PROVIDERS,
} from "$lib/provider-keys";
import type { D1Database } from "@cloudflare/workers-types";

export interface RuntimeEnv {
  DB: D1Database;
  Sandbox: ContainerEnv["Sandbox"];
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
}

interface AgentExecutionConfig {
  harnessId: string;
  model: string;
  policy: NodeRuntimePolicy;
  workspaceId: string;
  gitRepoUrl: string | null;
  entryCommand: string;
  executionRoot: string;
  envVars: Record<string, string>;
}

interface ExecRelay {
  onOutput: (stream: "stdout" | "stderr", data: string) => void;
  flush: () => void;
  events: () => AgentEventType[];
  fallbackText: () => string;
  stderrSummary: () => string;
}

interface MessageRow {
  id: string;
  role: string;
  content: string;
  created_at: number;
}

interface ResultRow {
  status: AgentResult["status"];
  summary: string;
  commands: string;
  files_touched: string;
  violations: string;
  diff_summary: string | null;
  commit_json: string | null;
  started_at: number;
  finished_at: number;
}

let runtimeSchemaReady = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      summary TEXT NOT NULL,
      commands TEXT NOT NULL,
      files_touched TEXT NOT NULL,
      violations TEXT NOT NULL,
      diff_summary TEXT,
      commit_json TEXT,
      started_at INTEGER NOT NULL,
      finished_at INTEGER NOT NULL
    )
  `).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS agent_task_agent_id_idx ON agent_task (agent_id)`).run().catch(() => {});
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS agent_task_finished_at_idx ON agent_task (finished_at)`).run().catch(() => {});

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

async function saveAgentMessage(
  env: RuntimeEnv,
  agentId: string,
  role: string,
  content: string,
): Promise<string> {
  await ensureRuntimeSchema(env);
  const id = crypto.randomUUID();
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO agent_message (id, agent_id, role, content, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(id, agentId, role, content, now).run();
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

async function saveAgentResult(
  env: RuntimeEnv,
  agentId: string,
  content: string,
  result: AgentResult,
): Promise<void> {
  await ensureRuntimeSchema(env);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO agent_task
      (id, agent_id, content, status, summary, commands, files_touched, violations, diff_summary, commit_json, started_at, finished_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id,
    agentId,
    content,
    result.status,
    result.summary,
    JSON.stringify(result.commands),
    JSON.stringify(result.filesTouched),
    JSON.stringify(result.violations),
    result.diffSummary ?? null,
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
  const row = await env.DB.prepare(
    `SELECT status, summary, commands, files_touched, violations, diff_summary, commit_json, started_at, finished_at
       FROM agent_task
      WHERE agent_id = ?
      ORDER BY finished_at DESC
      LIMIT 1`,
  ).bind(agentId).first<ResultRow>();

  if (!row) {
    const legacyRow = await env.DB.prepare(
      `SELECT status, summary, commands, files_touched, violations, diff_summary, commit_json, started_at, finished_at
         FROM agent_result
        WHERE agent_id = ?
        LIMIT 1`,
    ).bind(agentId).first<ResultRow>();
    if (!legacyRow) return null;

    return {
      status: legacyRow.status,
      summary: legacyRow.summary,
      commands: JSON.parse(legacyRow.commands) as AgentResult["commands"],
      filesTouched: JSON.parse(legacyRow.files_touched) as string[],
      violations: JSON.parse(legacyRow.violations) as string[],
      diffSummary: legacyRow.diff_summary,
      commit: legacyRow.commit_json
        ? (JSON.parse(legacyRow.commit_json) as NonNullable<AgentResult["commit"]>)
        : null,
      startedAt: legacyRow.started_at,
      finishedAt: legacyRow.finished_at,
    };
  }

  return {
    status: row.status,
    summary: row.summary,
    commands: JSON.parse(row.commands) as AgentResult["commands"],
    filesTouched: JSON.parse(row.files_touched) as string[],
    violations: JSON.parse(row.violations) as string[],
    diffSummary: row.diff_summary,
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

async function getAgentStatus(
  env: RuntimeEnv,
  workspaceId: string,
  agentId: string,
): Promise<AgentStatusType> {
  const row = await env.DB.prepare(
    `SELECT status
       FROM agent
      WHERE id = ? AND workspace_id = ?
      LIMIT 1`,
  ).bind(agentId, workspaceId).first<{ status: AgentStatusType }>();

  if (!row) {
    throw new Error(`Agent ${agentId} not found.`);
  }

  return row.status;
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
    throw new Error(`Agent ${agentId} not found.`);
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

async function loadAgentExecutionConfig(
  env: RuntimeEnv,
  agentId: string,
  workspaceId: string,
  task: string,
): Promise<AgentExecutionConfig> {
  const row = await env.DB.prepare(
    `SELECT w.harness_id, w.model, w.allowed_paths, w.forbidden_paths,
            w.tool_permissions, w.writable_root, s.id as workspace_id, s.git_repo_url,
            u.openrouter_api_key as user_key, h.entry_command as entry_command
       FROM agent w
       JOIN workspace s ON w.workspace_id = s.id
       JOIN user u ON s.user_id = u.id
       JOIN harness h ON h.id = w.harness_id
      WHERE w.id = ? AND w.workspace_id = ?`,
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
    throw new Error(`Agent ${agentId} not found.`);
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
      throw new Error(
        "Stored account router keys are unreadable. Re-save your account keys and try again.",
      );
    }
  }

  if (!containerApiKey) {
    throw new Error(`No valid API key available for the ${providerDefinition.label} router.`);
  }

  const workspaceRoot = resolveWorkspaceRoot(row.git_repo_url);
  const policy = normalizeNodeRuntimePolicy("agent", {
    allowedPaths: parseJsonArray(row.allowed_paths),
    forbiddenPaths: parseJsonArray(row.forbidden_paths),
    toolPermissions: parseJsonArray(row.tool_permissions),
    writableRoot: row.writable_root,
  });
  const policyError = validateNodeRuntimePolicy("agent", policy);
  if (policyError) {
    throw new Error(policyError);
  }

  const executionRoot = resolveScopedWorkspaceRoot(workspaceRoot, policy.writableRoot);
  const envVars: Record<string, string> = {
    ...buildAgentEnv({
      harnessId: row.harness_id as HarnessId,
      model: canonicalizeStoredModel(row.model),
      apiKey: containerApiKey,
      task,
      workspacePath: workspaceRoot,
      authority: "agent",
      allowedPaths: policy.allowedPaths,
      forbiddenPaths: policy.forbiddenPaths,
      toolPermissions: policy.toolPermissions,
      writableRoot: policy.writableRoot,
    }),
    FILEPATH_AGENT_ID: agentId,
    FILEPATH_WORKSPACE_ID: row.workspace_id,
  };

  if (!row.entry_command) {
    throw new Error(`Harness ${row.harness_id} has no entry command.`);
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
  const sandbox = getSandbox(env.Sandbox, agentId);
  const workspaceRoot = resolveWorkspaceRoot(gitRepoUrl);

  if (gitRepoUrl) {
    const workspaceExists = await sandbox.exists(workspaceRoot);
    if (!workspaceExists.exists) {
      await cloneRepo(
        { Sandbox: env.Sandbox } as ContainerEnv,
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

function createExecRelay(): ExecRelay {
  let stdoutBuffer = "";
  const parsedEvents: AgentEventType[] = [];
  const rawStdoutLines: string[] = [];
  const stderrChunks: string[] = [];

  const handleLine = (line: string) => {
    const event = parseAgentEvent(line);
    if (event) {
      parsedEvents.push(event);
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
    events: () => parsedEvents,
    fallbackText: () => rawStdoutLines.join("\n").trim(),
    stderrSummary: () => stderrChunks.join("\n").trim(),
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
    commit,
    startedAt,
    finishedAt,
  };
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

async function recordAgentFailure(
  env: RuntimeEnv,
  agentId: string,
  runtimeStatus: AgentStatusType,
  resultStatus: AgentResult["status"],
  summary: string,
  violations: string[] = [],
  content = "",
): Promise<AgentResult> {
  await saveAgentMessage(env, agentId, "assistant", summary);
  await setAgentStatus(env, agentId, runtimeStatus);

  const now = Date.now();
  const result: AgentResult = {
    status: resultStatus,
    summary,
    commands: [],
    filesTouched: [],
    violations,
    diffSummary: null,
    commit: null,
    startedAt: now,
    finishedAt: now,
  };
  await saveAgentResult(env, agentId, content, result);
  return result;
}

async function stopContainer(env: RuntimeEnv, agentId: string): Promise<void> {
  await ensureRuntimeSchema(env);
  const row = await env.DB.prepare(
    `SELECT active_process_id
       FROM agent
      WHERE id = ?
      LIMIT 1`,
  ).bind(agentId).first<{ active_process_id: string | null }>();

  if (row?.active_process_id) {
    const sandbox = getSandbox(env.Sandbox, agentId);
    await sandbox.killProcess(row.active_process_id).catch(() => {});
  }

  await env.DB.prepare(
    `UPDATE agent
        SET active_process_id = NULL,
            cancel_requested = 0,
            updated_at = unixepoch('subsecond') * 1000
      WHERE id = ?`,
  ).bind(agentId).run();
}

export async function getAgentRuntimeSnapshot(
  env: RuntimeEnv,
  workspaceId: string,
  agentId: string,
): Promise<AgentRuntimeSnapshot> {
  const status = await getAgentStatus(env, workspaceId, agentId);
  const messages = await loadAgentMessages(env, agentId);
  const result = await loadAgentResult(env, agentId);

  return {
    status,
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.created_at,
    })),
    result,
  };
}

export async function runAgentTask(
  env: RuntimeEnv,
  workspaceId: string,
  agentId: string,
  content: string,
): Promise<AgentResult> {
  await ensureRuntimeSchema(env);
  const currentState = await getAgentExecutionState(env, workspaceId, agentId);
  if (currentState.status === "exhausted") {
    return recordAgentFailure(
      env,
      agentId,
      "exhausted",
      "policy_error",
      "This agent is exhausted and read-only.",
      ["Agent is exhausted."],
      content,
    );
  }

  if (currentState.activeProcessId || currentState.status === "thinking") {
    throw new Error("This agent is already processing a task. Wait for it to finish.");
  }

  await saveAgentMessage(env, agentId, "user", content);

  const transcript = await getAgentTranscript(env, agentId, 12);
  const task = transcript
    ? [
        "Continue this filepath agent task from the transcript below.",
        "Reply only as the selected harness running in the sandbox.",
        "",
        transcript,
        "",
        "Respond to the latest human task in context.",
      ].join("\n")
    : content;

  let config: AgentExecutionConfig;
  let sandbox: Sandbox;

  try {
    config = await loadAgentExecutionConfig(env, agentId, workspaceId, task);
    sandbox = await ensureContainer(env, agentId, config.gitRepoUrl);
    await sandbox.mkdir(config.executionRoot, { recursive: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return recordAgentFailure(
      env,
      agentId,
      "error",
      "error",
      `Could not start the agent sandbox: ${message}`,
      [],
      content,
    );
  }

  const relay = createExecRelay();
  const startedAt = Date.now();
  const processId = `${agentId}-${startedAt}`;

  try {
    const process = await sandbox.startProcess(config.entryCommand, {
      processId,
      cwd: config.executionRoot,
      env: config.envVars,
      onOutput: relay.onOutput,
      autoCleanup: false,
    });

    await env.DB.prepare(
      `UPDATE agent
          SET status = ?,
              active_process_id = ?,
              cancel_requested = 0,
              updated_at = unixepoch('subsecond') * 1000
        WHERE id = ?`,
    ).bind("thinking", process.id, agentId).run();

    let exitCode: number | null = null;
    while (true) {
      const postRunState = await getAgentExecutionState(env, workspaceId, agentId);
      if (postRunState.cancelRequested) {
        await sandbox.killProcess(process.id).catch(() => {});
        return recordAgentFailure(
          env,
          agentId,
          "idle",
          "aborted",
          "The agent task was cancelled.",
          [],
          content,
        );
      }

      const processStatus = await process.getStatus();
      if (processStatus === "completed") {
        exitCode = process.exitCode ?? 0;
        break;
      }

      if (processStatus === "failed" || processStatus === "error") {
        exitCode = process.exitCode ?? 1;
        break;
      }

      if (processStatus === "killed") {
        return recordAgentFailure(
          env,
          agentId,
          "idle",
          "aborted",
          "The agent task was cancelled.",
          [],
          content,
        );
      }

      await sleep(250);
    }

    relay.flush();

    const postRunState = await getAgentExecutionState(env, workspaceId, agentId);
    if (postRunState.cancelRequested || exitCode === null) {
      return recordAgentFailure(
        env,
        agentId,
        "idle",
        "aborted",
        "The agent task was cancelled.",
        [],
        content,
      );
    }

    if (exitCode !== 0) {
      const logs = await process.getLogs().catch(() => ({ stdout: "", stderr: "" }));
      const stderrSummary = relay.stderrSummary() || logs.stderr.trim();
      throw new Error(
        stderrSummary
          ? `Sandbox command failed (${exitCode}): ${stderrSummary}`
          : `Sandbox command failed (${exitCode}).`,
      );
    }

    // Enforcement: policy validated at agent create (authority.ts), passed via env to adapter.
    // Post-run we check events; violations cause policy_error and are stored in agent_task.
    const policyViolation = getRuntimePolicyViolation("agent", config.policy, relay.events());
    if (policyViolation) {
      return recordAgentFailure(
        env,
        agentId,
        "error",
        "policy_error",
        policyViolation,
        [policyViolation],
        content,
      );
    }

    await persistAssistantText(env, agentId, relay.events(), relay.fallbackText());
    const outcome = buildAgentResultFromEvents(
      relay.events(),
      relay.fallbackText(),
      startedAt,
      Date.now(),
    );
    await saveAgentResult(env, agentId, content, outcome);

    const terminalStatus = relay.events().some((event) => event.type === "handoff")
      ? "exhausted"
      : "done";
    await setAgentStatus(env, agentId, terminalStatus);

    if (terminalStatus === "exhausted") {
      await stopContainer(env, agentId);
    }

    return outcome;
  } catch (error) {
    const postRunState = await getAgentExecutionState(env, workspaceId, agentId).catch(() => ({
      status: "error" as AgentStatusType,
      activeProcessId: null,
      cancelRequested: false,
    }));
    const aborted =
      postRunState.cancelRequested ||
      (error instanceof DOMException
        ? error.name === "AbortError"
        : error instanceof Error
          ? /abort/i.test(error.name) || /abort/i.test(error.message)
          : false);

    return recordAgentFailure(
      env,
      agentId,
      aborted ? "idle" : "error",
      aborted ? "aborted" : "error",
      aborted
        ? "The agent task was cancelled."
        : `The sandbox runtime failed while handling this task: ${error instanceof Error ? error.message : String(error)}`,
      [],
      content,
    );
  } finally {
    await env.DB.prepare(
      `UPDATE agent
          SET active_process_id = NULL,
              cancel_requested = 0,
              updated_at = unixepoch('subsecond') * 1000
        WHERE id = ?`,
    ).bind(agentId).run();
  }
}

export async function cancelAgentTask(
  env: RuntimeEnv,
  agentId: string,
): Promise<boolean> {
  await ensureRuntimeSchema(env);
  const row = await env.DB.prepare(
    `SELECT active_process_id
       FROM agent
      WHERE id = ?
      LIMIT 1`,
  ).bind(agentId).first<{ active_process_id: string | null }>();

  if (!row?.active_process_id) {
    return false;
  }

  await env.DB.prepare(
    `UPDATE agent
        SET cancel_requested = 1,
            updated_at = unixepoch('subsecond') * 1000
      WHERE id = ?`,
  ).bind(agentId).run();

  const sandbox = getSandbox(env.Sandbox, agentId);
  await sandbox.killProcess(row.active_process_id).catch(() => {});
  return true;
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
