import { Agent, type Connection, type ConnectionContext, type WSMessage } from "agents";
import { SubAgent, withSubAgents } from "agents/experimental/subagent";
import { getSandbox, type Sandbox } from "@cloudflare/sandbox";
import { parseAgentEvent } from "$lib/protocol";
import type { AgentEventType, AgentStatusType } from "$lib/protocol";
import { resolveRequestAuth } from "$lib/auth";
import { buildAgentEnv } from "$lib/agents/adapters";
import { verifyDashboardWsToken } from "$lib/dashboard-ws-auth";
import { BUILTIN_HARNESSES, getBuiltinHarnessRows } from "$lib/agents/harnesses";
import { cloneRepo, resolveWorkspaceRoot, type ContainerEnv } from "$lib/agents/container";
import type { HarnessId } from "$lib/types/session";
import { decryptApiKey } from "$lib/crypto";
import { resolveBetterAuthSecret } from "$lib/better-auth-secret";
import {
  canonicalizeStoredModel,
  PROVIDERS,
  deserializeStoredProviderKeys,
  getProviderForModel,
} from "$lib/provider-keys";
import type { Env } from "../types";

type ChatTransportMessage =
  | {
      type: "history";
      messages: Array<{
        id: string;
        role: string;
        content: string;
        createdAt: number;
      }>;
    }
  | {
      type: "event";
      event: AgentEventType | { type: "status"; state: AgentStatusType };
      role?: "user" | "assistant";
      messageId?: string;
      nodeId?: string;
      timestamp: number;
    }
  | {
      type: "error";
      message: string;
      nodeId?: string;
    };

export interface ChatAgentState {
  sessionId: string;
  initialized: boolean;
}

interface MessageRow {
  id: string;
  role: string;
  content: string;
  created_at: number;
}

interface NodeExecutionConfig {
  harnessId: string;
  model: string;
  sessionId: string;
  gitRepoUrl: string | null;
  entryCommand: string;
  envVars: Record<string, string>;
  keySource?: "user";
}

interface ContainerHandle {
  sandbox: Sandbox;
  nodeId: string;
  workspaceRoot: string;
  activeExecution: boolean;
}

interface ExecRelay {
  onOutput: (stream: "stdout" | "stderr", data: string) => void;
  flush: () => void;
  events: () => AgentEventType[];
  fallbackText: () => string;
  stderrSummary: () => string;
}

const ChatAgentBase = withSubAgents(Agent);

function serialize(message: ChatTransportMessage): string {
  return JSON.stringify(message);
}

export class ChatNodeAgent extends SubAgent<Env> {
  private schemaReady = false;

  private get nodeId(): string {
    return this.name;
  }

  private ensureSchema(): void {
    if (this.schemaReady) return;
    this.sql`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      )
    `;
    this.sql`
      CREATE TABLE IF NOT EXISTS node_state (
        node_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'idle',
        initialized INTEGER NOT NULL DEFAULT 1
      )
    `;
    this.schemaReady = true;
  }

  private async ensureBuiltinHarnesses(): Promise<void> {
    const statements = getBuiltinHarnessRows().map((harness) =>
      this.env.DB.prepare(
        `INSERT OR IGNORE INTO agent_harness
          (id, name, description, adapter, entry_command, default_model, icon, enabled, config)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        harness.id,
        harness.name,
        harness.description,
        harness.adapter,
        harness.entryCommand,
        harness.defaultModel,
        harness.icon,
        harness.enabled ? 1 : 0,
        harness.config,
      ),
    );

    await this.env.DB.batch(statements);
  }

  private saveMessage(role: string, content: string): string {
    this.ensureSchema();
    const id = crypto.randomUUID();
    const now = Date.now();
    this.sql`
      INSERT INTO messages (id, role, content, created_at)
      VALUES (${id}, ${role}, ${content}, ${now})
    `;
    return id;
  }

  private loadMessages(): MessageRow[] {
    this.ensureSchema();
    return this.sql<MessageRow>`
      SELECT id, role, content, created_at FROM messages
      ORDER BY created_at ASC
    `;
  }

  private getStateRow(): { session_id: string; status: AgentStatusType } | null {
    this.ensureSchema();
    return (
      this.sql<{ session_id: string; status: AgentStatusType }>`
        SELECT session_id, status FROM node_state
        WHERE node_id = ${this.nodeId}
        LIMIT 1
      `[0] ?? null
    );
  }

  private async setStatus(status: AgentStatusType): Promise<void> {
    this.ensureSchema();
    this.sql`
      UPDATE node_state
      SET status = ${status}
      WHERE node_id = ${this.nodeId}
    `;
    await this.env.DB.prepare(
      `UPDATE agent_node
          SET status = ?, updated_at = unixepoch('subsecond') * 1000
        WHERE id = ?`,
    ).bind(status, this.nodeId).run();
  }

  async ensureInitialized(sessionId: string): Promise<{ ok: true }> {
    this.ensureSchema();
    const state = this.getStateRow();
    if (state) {
      if (state.session_id !== sessionId) {
        throw new Error(`Node ${this.nodeId} is already bound to another session.`);
      }
      return { ok: true };
    }

    const row = await this.env.DB.prepare(
      `SELECT id, status
         FROM agent_node
        WHERE id = ? AND session_id = ?
        LIMIT 1`,
    ).bind(this.nodeId, sessionId).first<{ id: string; status: AgentStatusType }>();

    if (!row) {
      throw new Error(`Node ${this.nodeId} not found for session ${sessionId}.`);
    }

    this.sql`
      INSERT INTO node_state (node_id, session_id, status, initialized)
      VALUES (${this.nodeId}, ${sessionId}, ${row.status ?? "idle"}, 1)
    `;

    return { ok: true };
  }

  async getSnapshot(sessionId: string): Promise<{
    status: AgentStatusType;
    messages: Array<{ id: string; role: string; content: string; createdAt: number }>;
  }> {
    await this.ensureInitialized(sessionId);
    const state = this.getStateRow();
    return {
      status: state?.status ?? "idle",
      messages: this.loadMessages().map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.created_at,
      })),
    };
  }

  async getTranscript(sessionId: string, limit = 12): Promise<string> {
    await this.ensureInitialized(sessionId);
    return this.loadMessages()
      .filter((message) => message.role === "user" || message.role === "assistant")
      .slice(-limit)
      .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`)
      .join("\n\n");
  }

  async getStatus(sessionId: string): Promise<AgentStatusType> {
    await this.ensureInitialized(sessionId);
    return this.getStateRow()?.status ?? "idle";
  }

  async appendUserMessage(sessionId: string, content: string): Promise<ChatTransportMessage> {
    await this.ensureInitialized(sessionId);
    const messageId = this.saveMessage("user", content);
    return {
      type: "event",
      event: { type: "text", content },
      role: "user",
      messageId,
      nodeId: this.nodeId,
      timestamp: Date.now(),
    };
  }

  async persistStatusEnvelope(sessionId: string, status: AgentStatusType): Promise<ChatTransportMessage> {
    await this.ensureInitialized(sessionId);
    await this.setStatus(status);
    return {
      type: "event",
      event: { type: "status", state: status },
      nodeId: this.nodeId,
      timestamp: Date.now(),
    };
  }

  async loadExecutionConfig(sessionId: string, task: string): Promise<NodeExecutionConfig> {
    await this.ensureInitialized(sessionId);
    await this.ensureBuiltinHarnesses();

    const row = await this.env.DB.prepare(
      `SELECT n.harness_id, n.model, s.id as session_id, s.git_repo_url,
              u.openrouter_api_key as user_key, h.entry_command as entry_command
         FROM agent_node n
         JOIN agent_session s ON n.session_id = s.id
         JOIN user u ON s.user_id = u.id
         JOIN agent_harness h ON h.id = n.harness_id
        WHERE n.id = ? AND n.session_id = ?`,
    ).bind(this.nodeId, sessionId).first<{
      harness_id: string;
      model: string;
      session_id: string;
      git_repo_url: string | null;
      user_key: string | null;
      entry_command: string;
    }>();

    if (!row) {
      throw new Error(`Node ${this.nodeId} not found in D1.`);
    }

    const provider = getProviderForModel(row.model);
    const providerDefinition = PROVIDERS[provider];
    let containerApiKey = "";
    const secret = resolveBetterAuthSecret({
      envSecret: this.env.BETTER_AUTH_SECRET,
      baseURL: this.env.BETTER_AUTH_URL,
    });

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
    const envVars: Record<string, string> = {
      ...buildAgentEnv({
        harnessId: row.harness_id as HarnessId,
        model: canonicalizeStoredModel(row.model),
        apiKey: containerApiKey,
        task,
        workspacePath: workspaceRoot,
      }),
      FILEPATH_AGENT_ID: this.nodeId,
      FILEPATH_SESSION_ID: row.session_id,
    };

    const builtinHarness = BUILTIN_HARNESSES.find((harness) => harness.id === row.harness_id);
    const entryCommand = row.entry_command || builtinHarness?.entryCommand || "";
    if (!entryCommand) {
      throw new Error(`Harness ${row.harness_id} has no entry command.`);
    }

    return {
      harnessId: row.harness_id,
      model: row.model,
      sessionId: row.session_id,
      gitRepoUrl: row.git_repo_url,
      entryCommand,
      envVars,
      keySource: "user",
    };
  }

  async recordExecutionOutcome(
    sessionId: string,
    events: AgentEventType[],
    fallbackText: string,
  ): Promise<{
    envelopes: ChatTransportMessage[];
    terminalStatus: AgentStatusType | null;
  }> {
    await this.ensureInitialized(sessionId);

    const envelopes: ChatTransportMessage[] = [];
    let terminalStatus: AgentStatusType | null = null;

    const pushEventEnvelope = (
      event: AgentEventType | { type: "status"; state: AgentStatusType },
      options?: {
        role?: "assistant";
        messageId?: string;
      },
    ) => {
      envelopes.push({
        type: "event",
        event,
        role: options?.role,
        messageId: options?.messageId,
        nodeId: this.nodeId,
        timestamp: Date.now(),
      });
    };

    if (!events.length && fallbackText.trim()) {
      const messageId = this.saveMessage("assistant", fallbackText.trim());
      pushEventEnvelope(
        { type: "text", content: fallbackText.trim() },
        { role: "assistant", messageId },
      );
      return { envelopes, terminalStatus };
    }

    for (const event of events) {
      if (event.type === "text") {
        const messageId = this.saveMessage("assistant", event.content);
        pushEventEnvelope(event, { role: "assistant", messageId });
        continue;
      }

      if (event.type === "tool") {
        this.saveMessage(
          "assistant",
          `[tool:${event.name}] ${event.status}${event.path ? ` ${event.path}` : ""}`,
        );
        pushEventEnvelope(event);
        continue;
      }

      if (event.type === "status") {
        await this.setStatus(event.state);
        pushEventEnvelope(event);
        if (event.state === "exhausted" || event.state === "error") {
          terminalStatus = event.state;
        }
        continue;
      }

      if (event.type === "done") {
        if (event.summary) {
          this.saveMessage("assistant", event.summary);
        }
        await this.setStatus("done");
        pushEventEnvelope(event);
        terminalStatus = "done";
        continue;
      }

      if (event.type === "handoff") {
        this.saveMessage("assistant", `Exhausted: ${event.summary}`);
        await this.setStatus("exhausted");
        pushEventEnvelope(event);
        terminalStatus = "exhausted";
        continue;
      }

      if (event.type === "spawn") {
        console.log(
          `[ChatNodeAgent] Spawn request from node ${this.nodeId}: ` +
            `agent=${event.agent} name=${event.name} task=${event.task ?? "(none)"}`,
        );
      }

      pushEventEnvelope(event);
    }

    return { envelopes, terminalStatus };
  }

  async recordSandboxFailure(sessionId: string, reason: string): Promise<{
    warningEnvelope: ChatTransportMessage;
    statusEnvelope: ChatTransportMessage;
    errorMessage: string;
  }> {
    await this.ensureInitialized(sessionId);

    const detail =
      `${reason}. filepath will not bypass the sandbox with a direct model call. ` +
      "Inspect the container runtime and retry when setup is fixed.";
    const summary = "This agent failed to start in the sandbox.";
    const messageId = this.saveMessage("assistant", `Warning: ${summary} ${detail}`);
    await this.setStatus("error");

    return {
      warningEnvelope: {
        type: "event",
        event: { type: "text", content: `Warning: ${summary} ${detail}` },
        role: "assistant",
        messageId,
        nodeId: this.nodeId,
        timestamp: Date.now(),
      },
      statusEnvelope: {
        type: "event",
        event: { type: "status", state: "error" },
        nodeId: this.nodeId,
        timestamp: Date.now(),
      },
      errorMessage: `${summary} ${detail}`,
    };
  }
}

export class ChatAgent extends ChatAgentBase<Env, ChatAgentState> {
  initialState: ChatAgentState = {
    sessionId: "",
    initialized: false,
  };

  private schemaReady = false;
  private containers: Map<string, ContainerHandle> = new Map();
  private connectionNodes: Map<string, string> = new Map();

  private getBetterAuthSecret(): string | undefined {
    return resolveBetterAuthSecret({
      envSecret: this.env.BETTER_AUTH_SECRET,
      baseURL: this.env.BETTER_AUTH_URL,
    });
  }

  private parseRoute(url: URL): { sessionId: string | null } {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 3 || parts[0] !== "agents" || parts[1] !== "chat-agent") {
      return { sessionId: null };
    }
    return {
      sessionId: parts[2] ?? null,
    };
  }

  private ensureSchema(): void {
    if (this.schemaReady) return;
    this.sql`
      CREATE TABLE IF NOT EXISTS node_messages (
        id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      )
    `;
    this.sql`
      CREATE TABLE IF NOT EXISTS node_state (
        node_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'idle',
        initialized INTEGER NOT NULL DEFAULT 1
      )
    `;
    this.schemaReady = true;
  }

  private async ensureBuiltinHarnesses(): Promise<void> {
    const statements = getBuiltinHarnessRows().map((harness) =>
      this.env.DB.prepare(
        `INSERT OR IGNORE INTO agent_harness
          (id, name, description, adapter, entry_command, default_model, icon, enabled, config)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        harness.id,
        harness.name,
        harness.description,
        harness.adapter,
        harness.entryCommand,
        harness.defaultModel,
        harness.icon,
        harness.enabled ? 1 : 0,
        harness.config,
      ),
    );

    await this.env.DB.batch(statements);
  }

  private saveNodeMessage(nodeId: string, role: string, content: string): string {
    this.ensureSchema();
    const id = crypto.randomUUID();
    const now = Date.now();
    this.sql`
      INSERT INTO node_messages (id, node_id, role, content, created_at)
      VALUES (${id}, ${nodeId}, ${role}, ${content}, ${now})
    `;
    return id;
  }

  private loadNodeMessages(nodeId: string): MessageRow[] {
    this.ensureSchema();
    return this.sql<MessageRow>`
      SELECT id, role, content, created_at
      FROM node_messages
      WHERE node_id = ${nodeId}
      ORDER BY created_at ASC
    `;
  }

  private getNodeStateRow(nodeId: string): { session_id: string; status: AgentStatusType } | null {
    this.ensureSchema();
    return (
      this.sql<{ session_id: string; status: AgentStatusType }>`
        SELECT session_id, status
        FROM node_state
        WHERE node_id = ${nodeId}
        LIMIT 1
      `[0] ?? null
    );
  }

  private async setNodeStatus(nodeId: string, status: AgentStatusType): Promise<void> {
    this.ensureSchema();
    this.sql`
      UPDATE node_state
      SET status = ${status}
      WHERE node_id = ${nodeId}
    `;
    await this.env.DB.prepare(
      `UPDATE agent_node
          SET status = ?, updated_at = unixepoch('subsecond') * 1000
        WHERE id = ?`,
    ).bind(status, nodeId).run();
  }

  private async ensureNodeInitialized(nodeId: string, sessionId: string): Promise<void> {
    this.ensureSchema();
    const state = this.getNodeStateRow(nodeId);
    if (state) {
      if (state.session_id !== sessionId) {
        throw new Error(`Node ${nodeId} is already bound to another session.`);
      }
      return;
    }

    const row = await this.env.DB.prepare(
      `SELECT id, status
         FROM agent_node
        WHERE id = ? AND session_id = ?
        LIMIT 1`,
    ).bind(nodeId, sessionId).first<{ id: string; status: AgentStatusType }>();

    if (!row) {
      throw new Error(`Node ${nodeId} not found for session ${sessionId}.`);
    }

    this.sql`
      INSERT INTO node_state (node_id, session_id, status, initialized)
      VALUES (${nodeId}, ${sessionId}, ${row.status ?? "idle"}, 1)
    `;
  }

  private async getNodeSnapshot(nodeId: string, sessionId: string): Promise<{
    status: AgentStatusType;
    messages: Array<{ id: string; role: string; content: string; createdAt: number }>;
  }> {
    await this.ensureNodeInitialized(nodeId, sessionId);
    const state = this.getNodeStateRow(nodeId);
    return {
      status: state?.status ?? "idle",
      messages: this.loadNodeMessages(nodeId).map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.created_at,
      })),
    };
  }

  private async getNodeTranscript(nodeId: string, sessionId: string, limit = 12): Promise<string> {
    await this.ensureNodeInitialized(nodeId, sessionId);
    return this.loadNodeMessages(nodeId)
      .filter((message) => message.role === "user" || message.role === "assistant")
      .slice(-limit)
      .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`)
      .join("\n\n");
  }

  private async getNodeStatus(nodeId: string, sessionId: string): Promise<AgentStatusType> {
    await this.ensureNodeInitialized(nodeId, sessionId);
    return this.getNodeStateRow(nodeId)?.status ?? "idle";
  }

  private async appendNodeUserMessage(nodeId: string, sessionId: string, content: string): Promise<ChatTransportMessage> {
    await this.ensureNodeInitialized(nodeId, sessionId);
    const messageId = this.saveNodeMessage(nodeId, "user", content);
    return {
      type: "event",
      event: { type: "text", content },
      role: "user",
      messageId,
      nodeId,
      timestamp: Date.now(),
    };
  }

  private async persistNodeStatusEnvelope(
    nodeId: string,
    sessionId: string,
    status: AgentStatusType,
  ): Promise<ChatTransportMessage> {
    await this.ensureNodeInitialized(nodeId, sessionId);
    await this.setNodeStatus(nodeId, status);
    return {
      type: "event",
      event: { type: "status", state: status },
      nodeId,
      timestamp: Date.now(),
    };
  }

  private async loadNodeExecutionConfig(nodeId: string, sessionId: string, task: string): Promise<NodeExecutionConfig> {
    await this.ensureNodeInitialized(nodeId, sessionId);
    await this.ensureBuiltinHarnesses();

    const row = await this.env.DB.prepare(
      `SELECT n.harness_id, n.model, s.id as session_id, s.git_repo_url,
              u.openrouter_api_key as user_key, h.entry_command as entry_command
         FROM agent_node n
         JOIN agent_session s ON n.session_id = s.id
         JOIN user u ON s.user_id = u.id
         JOIN agent_harness h ON h.id = n.harness_id
        WHERE n.id = ? AND n.session_id = ?`,
    ).bind(nodeId, sessionId).first<{
      harness_id: string;
      model: string;
      session_id: string;
      git_repo_url: string | null;
      user_key: string | null;
      entry_command: string;
    }>();

    if (!row) {
      throw new Error(`Node ${nodeId} not found in D1.`);
    }

    const provider = getProviderForModel(row.model);
    const providerDefinition = PROVIDERS[provider];
    let containerApiKey = "";
    const secret = this.getBetterAuthSecret();

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
    const envVars: Record<string, string> = {
      ...buildAgentEnv({
        harnessId: row.harness_id as HarnessId,
        model: canonicalizeStoredModel(row.model),
        apiKey: containerApiKey,
        task,
        workspacePath: workspaceRoot,
      }),
      FILEPATH_AGENT_ID: nodeId,
      FILEPATH_SESSION_ID: row.session_id,
    };

    const builtinHarness = BUILTIN_HARNESSES.find((harness) => harness.id === row.harness_id);
    const entryCommand = row.entry_command || builtinHarness?.entryCommand || "";
    if (!entryCommand) {
      throw new Error(`Harness ${row.harness_id} has no entry command.`);
    }

    return {
      harnessId: row.harness_id,
      model: row.model,
      sessionId: row.session_id,
      gitRepoUrl: row.git_repo_url,
      entryCommand,
      envVars,
      keySource: "user",
    };
  }

  private async recordNodeExecutionOutcome(
    nodeId: string,
    sessionId: string,
    events: AgentEventType[],
    fallbackText: string,
  ): Promise<{
    envelopes: ChatTransportMessage[];
    terminalStatus: AgentStatusType | null;
  }> {
    await this.ensureNodeInitialized(nodeId, sessionId);

    const envelopes: ChatTransportMessage[] = [];
    let terminalStatus: AgentStatusType | null = null;

    const pushEventEnvelope = (
      event: AgentEventType | { type: "status"; state: AgentStatusType },
      options?: {
        role?: "assistant";
        messageId?: string;
      },
    ) => {
      envelopes.push({
        type: "event",
        event,
        role: options?.role,
        messageId: options?.messageId,
        nodeId,
        timestamp: Date.now(),
      });
    };

    if (!events.length && fallbackText.trim()) {
      const messageId = this.saveNodeMessage(nodeId, "assistant", fallbackText.trim());
      pushEventEnvelope(
        { type: "text", content: fallbackText.trim() },
        { role: "assistant", messageId },
      );
      return { envelopes, terminalStatus };
    }

    for (const event of events) {
      if (event.type === "text") {
        const messageId = this.saveNodeMessage(nodeId, "assistant", event.content);
        pushEventEnvelope(event, { role: "assistant", messageId });
        continue;
      }

      if (event.type === "tool") {
        this.saveNodeMessage(
          nodeId,
          "assistant",
          `[tool:${event.name}] ${event.status}${event.path ? ` ${event.path}` : ""}`,
        );
        pushEventEnvelope(event);
        continue;
      }

      if (event.type === "status") {
        await this.setNodeStatus(nodeId, event.state);
        pushEventEnvelope(event);
        if (event.state === "exhausted" || event.state === "error") {
          terminalStatus = event.state;
        }
        continue;
      }

      if (event.type === "done") {
        if (event.summary) {
          this.saveNodeMessage(nodeId, "assistant", event.summary);
        }
        await this.setNodeStatus(nodeId, "done");
        pushEventEnvelope(event);
        terminalStatus = "done";
        continue;
      }

      if (event.type === "handoff") {
        this.saveNodeMessage(nodeId, "assistant", `Exhausted: ${event.summary}`);
        await this.setNodeStatus(nodeId, "exhausted");
        pushEventEnvelope(event);
        terminalStatus = "exhausted";
        continue;
      }

      if (event.type === "spawn") {
        console.log(
          `[ChatAgent] Spawn request from node ${nodeId}: ` +
            `agent=${event.agent} name=${event.name} task=${event.task ?? "(none)"}`,
        );
      }

      pushEventEnvelope(event);
    }

    return { envelopes, terminalStatus };
  }

  private async recordNodeSandboxFailure(nodeId: string, sessionId: string, reason: string): Promise<{
    warningEnvelope: ChatTransportMessage;
    statusEnvelope: ChatTransportMessage;
    errorMessage: string;
  }> {
    await this.ensureNodeInitialized(nodeId, sessionId);

    const detail =
      `${reason}. filepath will not bypass the sandbox with a direct model call. ` +
      "Inspect the container runtime and retry when setup is fixed.";
    const summary = "This agent failed to start in the sandbox.";
    const messageId = this.saveNodeMessage(nodeId, "assistant", `Warning: ${summary} ${detail}`);
    await this.setNodeStatus(nodeId, "error");

    return {
      warningEnvelope: {
        type: "event",
        event: { type: "text", content: `Warning: ${summary} ${detail}` },
        role: "assistant",
        messageId,
        nodeId,
        timestamp: Date.now(),
      },
      statusEnvelope: {
        type: "event",
        event: { type: "status", state: "error" },
        nodeId,
        timestamp: Date.now(),
      },
      errorMessage: `${summary} ${detail}`,
    };
  }

  private sendToNodeConnections(nodeId: string, payload: ChatTransportMessage, excludeIds: string[] = []): void {
    const encoded = serialize(payload);
    for (const connection of this.getConnections()) {
      if (this.connectionNodes.get(connection.id) !== nodeId) continue;
      if (excludeIds.includes(connection.id)) continue;
      connection.send(encoded);
    }
  }

  private async canConnectWithDashboardToken(
    sessionId: string,
    token: string,
  ): Promise<boolean> {
    const secret = this.getBetterAuthSecret();
    if (!secret) {
      console.warn(`[ChatAgent] Missing BETTER_AUTH_SECRET for dashboard websocket auth (${sessionId})`);
      return false;
    }

    const claims = await verifyDashboardWsToken(token, secret);
    if (!claims) {
      console.warn(`[ChatAgent] dashboard_token_invalid session=${sessionId}`);
      return false;
    }

    if (claims.sessionId !== sessionId) {
      console.warn(`[ChatAgent] dashboard_token_session_mismatch claim=${claims.sessionId} route=${sessionId}`);
      return false;
    }

    const row = await this.env.DB.prepare(
      `SELECT s.id
         FROM agent_session s
        WHERE s.id = ? AND s.user_id = ?
        LIMIT 1`,
    ).bind(sessionId, claims.userId).first<{ id: string }>();

    return Boolean(row);
  }

  private async ensureUserCanAccessSession(
    sessionId: string,
    userId: string,
  ): Promise<boolean> {
    const row = await this.env.DB.prepare(
      `SELECT s.id
         FROM agent_session s
        WHERE s.id = ? AND s.user_id = ?
        LIMIT 1`,
    ).bind(sessionId, userId).first<{ id: string }>();

    return Boolean(row);
  }

  private async sendInitialState(connection: Connection, sessionId: string, nodeId: string): Promise<void> {
    const snapshot = await this.getNodeSnapshot(nodeId, sessionId);
    connection.send(
      serialize({
        type: "history",
        messages: snapshot.messages,
      }),
    );
    connection.send(
      serialize({
        type: "event",
        event: { type: "status", state: snapshot.status },
        nodeId,
        timestamp: Date.now(),
      }),
    );
  }

  async ensureNodeRuntime(nodeId: string): Promise<{ ok: true }> {
    const sessionId = this.name;
    await this.ensureNodeInitialized(nodeId, sessionId);
    if (!this.state.initialized || this.state.sessionId !== sessionId) {
      this.setState({ sessionId, initialized: true });
    }
    return { ok: true };
  }

  async deleteNodeRuntime(nodeId: string): Promise<{ ok: true }> {
    try {
      await this.stopContainer(nodeId);
    } finally {
      this.connectionNodes.forEach((boundNodeId, connectionId) => {
        if (boundNodeId === nodeId) {
          this.connectionNodes.delete(connectionId);
        }
      });
    }
    return { ok: true };
  }

  async onConnect(connection: Connection, ctx: ConnectionContext): Promise<void> {
    const url = new URL(ctx.request.url);
    const token = url.searchParams.get("token");
    const { sessionId } = this.parseRoute(url);

    if (!sessionId) {
      console.warn(`[ChatAgent] route_miss url=${url.pathname}`);
      connection.close(4004, "Invalid agent route");
      return;
    }

    if (token && await this.canConnectWithDashboardToken(sessionId, token)) {
      return;
    }

    const auth = await resolveRequestAuth({
      db: this.env.DB,
      env: {
        BETTER_AUTH_SECRET: this.getBetterAuthSecret(),
      },
      baseURL: url.origin,
      headers: ctx.request.headers,
      apiKeyOverride: token,
    });

    if (!auth.user) {
      console.warn(`[ChatAgent] auth_rejected session=${sessionId} hasToken=${Boolean(token)}`);
      connection.close(4001, "Unauthorized");
      return;
    }

    const allowed = await this.ensureUserCanAccessSession(sessionId, auth.user.id);
    if (!allowed) {
      console.warn(`[ChatAgent] auth_session_mismatch session=${sessionId} user=${auth.user.id}`);
      connection.close(4003, "Forbidden");
      return;
    }
  }

  async onMessage(connection: Connection, message: WSMessage): Promise<void> {
    const text = typeof message === "string"
      ? message
      : new TextDecoder().decode(message as ArrayBuffer);

    let parsed: { type?: string; content?: string; nodeId?: string; sessionId?: string };
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { type: "message", content: text };
    }

    const nodeId = parsed.nodeId;
    const sessionId = parsed.sessionId ?? this.name;
    const content = parsed.content ?? text;

    if (!nodeId || !sessionId) {
      connection.send(serialize({ type: "error", message: "Missing node or session context." }));
      return;
    }

    if (parsed.type === "init") {
      this.connectionNodes.set(connection.id, nodeId);
      await this.sendInitialState(connection, sessionId, nodeId);
      return;
    }

    if (!content) return;

    await this.ensureNodeInitialized(nodeId, sessionId);
    this.connectionNodes.set(connection.id, nodeId);

    const status = await this.getNodeStatus(nodeId, sessionId);
    if (status === "exhausted") {
      connection.send(serialize({
        type: "error",
        message: "This agent is exhausted and read-only.",
        nodeId,
      }));
      return;
    }

    const userEnvelope = await this.appendNodeUserMessage(nodeId, sessionId, content);
    this.sendToNodeConnections(nodeId, userEnvelope, [connection.id]);

    await this.forwardToContainer(sessionId, nodeId, content, connection);
  }

  onClose(_connection: Connection, _code: number, _reason: string, _wasClean: boolean): void {
    this.connectionNodes.delete(_connection.id);
  }

  private async ensureContainer(nodeId: string, gitRepoUrl: string | null): Promise<ContainerHandle> {
    const existing = this.containers.get(nodeId);
    if (existing) {
      return existing;
    }

    const sandbox = getSandbox(
      this.env.Sandbox as unknown as Parameters<typeof getSandbox>[0],
      nodeId,
    );
    const workspaceRoot = resolveWorkspaceRoot(gitRepoUrl);

    console.log(`[ChatAgent] Preparing sandbox for node ${nodeId}`);
    if (gitRepoUrl) {
      const workspaceExists = await sandbox.exists(workspaceRoot);
      if (!workspaceExists.exists) {
        console.log(`[ChatAgent] Cloning repo for node ${nodeId}: ${gitRepoUrl}`);
        await cloneRepo(
          { Sandbox: this.env.Sandbox } as unknown as ContainerEnv,
          nodeId,
          gitRepoUrl,
          workspaceRoot,
        );
      }
    } else {
      await sandbox.mkdir(workspaceRoot, { recursive: true });
    }

    try {
      await this.env.DB.prepare(
        `UPDATE agent_node SET container_id = ?, updated_at = unixepoch('subsecond') * 1000 WHERE id = ?`,
      ).bind(nodeId, nodeId).run();
    } catch (error) {
      console.error(`[ChatAgent] Failed to persist container id for ${nodeId}:`, error);
    }

    const handle: ContainerHandle = {
      sandbox,
      nodeId,
      workspaceRoot,
      activeExecution: false,
    };

    this.containers.set(nodeId, handle);
    return handle;
  }

  private createExecRelay(): ExecRelay {
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

  private async forwardToContainer(
    sessionId: string,
    nodeId: string,
    content: string,
    connection: Connection,
  ): Promise<void> {
    const transcript = await this.getNodeTranscript(nodeId, sessionId, 12);
    const task = transcript
      ? [
          "Continue this filepath chat session from the transcript below.",
          "Reply only as the selected harness running in the sandbox.",
          "",
          transcript,
          "",
          "Respond to the latest user message in context.",
        ].join("\n")
      : content;

    let config: NodeExecutionConfig;
    let handle: ContainerHandle;

    try {
      config = await this.loadNodeExecutionConfig(nodeId, sessionId, task);
      handle = await this.ensureContainer(nodeId, config.gitRepoUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[ChatAgent] sandbox_prep_failed node=${nodeId} reason=${message}`);
      const failure = await this.recordNodeSandboxFailure(
        nodeId,
        sessionId,
        `Could not start the sandbox for this branch: ${message}`,
      );
      this.sendToNodeConnections(nodeId, failure.warningEnvelope);
      this.sendToNodeConnections(nodeId, failure.statusEnvelope);
      connection.send(serialize({ type: "error", message: failure.errorMessage, nodeId }));
      return;
    }

    if (handle.activeExecution) {
      connection.send(serialize({
        type: "error",
        message: "This agent is already processing a message. Wait for it to finish.",
        nodeId,
      }));
      return;
    }

    handle.activeExecution = true;
    this.sendToNodeConnections(nodeId, await this.persistNodeStatusEnvelope(nodeId, sessionId, "thinking"));
    const relay = this.createExecRelay();

    try {
      const result = await handle.sandbox.exec(config.entryCommand, {
        cwd: handle.workspaceRoot,
        env: config.envVars,
        stream: true,
        onOutput: relay.onOutput,
      });

      relay.flush();

      if (!result.success) {
        const stderrSummary = relay.stderrSummary() || result.stderr.trim();
        throw new Error(
          stderrSummary
            ? `Sandbox command failed (${result.exitCode}): ${stderrSummary}`
            : `Sandbox command failed (${result.exitCode}).`,
        );
      }

      const outcome = await this.recordNodeExecutionOutcome(
        nodeId,
        sessionId,
        relay.events(),
        relay.fallbackText(),
      );

      for (const envelope of outcome.envelopes) {
        this.sendToNodeConnections(nodeId, envelope);
      }

      if (!outcome.terminalStatus) {
        this.sendToNodeConnections(nodeId, await this.persistNodeStatusEnvelope(nodeId, sessionId, "done"));
      } else if (outcome.terminalStatus === "exhausted") {
        await this.stopContainer(nodeId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[ChatAgent] sandbox_exec_failed node=${nodeId} reason=${message}`);
      const failure = await this.recordNodeSandboxFailure(
        nodeId,
        sessionId,
        `The sandbox runtime failed while handling this message: ${message}`,
      );
      this.sendToNodeConnections(nodeId, failure.warningEnvelope);
      this.sendToNodeConnections(nodeId, failure.statusEnvelope);
      connection.send(serialize({ type: "error", message: failure.errorMessage, nodeId }));
    } finally {
      handle.activeExecution = false;
    }
  }

  private async stopContainer(nodeId: string): Promise<void> {
    const handle = this.containers.get(nodeId);
    if (!handle) return;
    handle.activeExecution = false;
    this.containers.delete(nodeId);
  }

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname.endsWith("/health")) {
      return new Response(JSON.stringify({ ok: true, sessionId: this.name }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("Not found", { status: 404 });
  }
}
