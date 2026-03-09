import { Agent } from "agents";
import type { Connection, ConnectionContext, WSMessage } from "agents";
import type { Env } from "../types";
import { parseAgentEvent } from "../lib/protocol";
import type { AgentEventType, AgentStatusType } from "../lib/protocol";
import { getSandbox, type Sandbox } from '@cloudflare/sandbox';
import { resolveRequestAuth } from '$lib/auth';
import { buildAgentEnv } from '$lib/agents/adapters';
import { verifyDashboardWsToken } from '$lib/dashboard-ws-auth';
import { BUILTIN_HARNESSES, getBuiltinHarnessRows } from '$lib/agents/harnesses';
import { cloneRepo, resolveWorkspaceRoot, type ContainerEnv } from '$lib/agents/container';
import type { HarnessId } from '$lib/types/session';
import { decryptApiKey } from '$lib/crypto';
import { resolveBetterAuthSecret } from '$lib/better-auth-secret';
import {
  canonicalizeStoredModel,
  PROVIDERS,
  deserializeStoredProviderKeys,
  getProviderForModel,
} from '$lib/provider-keys';

/**
 * ChatAgent — Durable Object for a single agent node.
 *
 * Responsibilities:
 * 1. Persist chat messages in DO SQLite (survives restarts)
 * 2. Relay messages between connected WebSocket clients (real-time sync)
 * 3. Spawn + manage containers for agent execution
 * 4. Fail explicitly if the sandbox path is unavailable
 *
 * SQLite tables (created on first use):
 *   messages(id, role, content, created_at)
 */

export interface ChatAgentState {
  nodeId: string;
  sessionId: string;
  harnessId: string;
  model: string;
  status: AgentStatusType;
  initialized: boolean;
  /** Resolved API key source for logging (not the key itself) */
  keySource?: 'session' | 'user';
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
  keySource?: ChatAgentState["keySource"];
}

interface ContainerHandle {
  sandbox: Sandbox;
  nodeId: string;
  workspaceRoot: string;
  activeExecution: boolean;
}

export class ChatAgent extends Agent<Env, ChatAgentState> {
  private schemaReady = false;
  private containers: Map<string, ContainerHandle> = new Map();

  private getBetterAuthSecret(): string | undefined {
    return resolveBetterAuthSecret({
      envSecret: this.env.BETTER_AUTH_SECRET,
      baseURL: this.env.BETTER_AUTH_URL,
    });
  }

  // ─── Schema ───────────────────────────────────────────

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
    this.schemaReady = true;
  }

  // ─── Persistence ──────────────────────────────────────

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

  private async canConnectWithDashboardToken(nodeId: string, token: string): Promise<boolean> {
    const secret = this.getBetterAuthSecret();
    if (!secret) {
      console.warn(`[ChatAgent] Missing BETTER_AUTH_SECRET for dashboard websocket auth (${nodeId})`);
      return false;
    }

    const claims = await verifyDashboardWsToken(token, secret);
    if (!claims) {
      console.warn(`[ChatAgent] Dashboard websocket token verification failed for node ${nodeId}`);
      return false;
    }

    const row = await this.env.DB.prepare(
      `SELECT n.id
         FROM agent_node n
         JOIN agent_session s ON n.session_id = s.id
        WHERE n.id = ? AND n.session_id = ? AND s.user_id = ?
        LIMIT 1`,
    ).bind(nodeId, claims.sessionId, claims.userId).first<{ id: string }>();

    if (!row) {
      console.warn(
        `[ChatAgent] Dashboard websocket token session mismatch for node ${nodeId} ` +
        `(session=${claims.sessionId}, user=${claims.userId})`,
      );
    }

    return !!row;
  }

  private sendInitialState(connection: Connection): void {
    const messages = this.loadMessages();
    connection.send(JSON.stringify({
      type: "history",
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.created_at,
      })),
    }));

    if (this.state?.initialized) {
      connection.send(JSON.stringify({
        type: "event",
        event: { type: "status", state: this.state.status },
        timestamp: Date.now(),
      }));
    }
  }

  // ─── WebSocket lifecycle ──────────────────────────────

  async onConnect(connection: Connection, ctx: ConnectionContext): Promise<void> {
    const url = new URL(ctx.request.url);
    const token = url.searchParams.get("token");
    const nodeId = url.pathname.split("/").pop();

    if (token && nodeId && await this.canConnectWithDashboardToken(nodeId, token)) {
      this.sendInitialState(connection);
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
      console.warn(
        `[ChatAgent] Websocket auth failed for ${nodeId ?? "unknown-node"} ` +
        `(hasToken=${Boolean(token)})`,
      );
      connection.close(4001, "Unauthorized");
      return;
    }

    this.sendInitialState(connection);
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

    const content = parsed.content ?? text;
    if (!content) return;

    // Initialize state from first message if needed
    if (!this.state?.initialized && parsed.nodeId) {
      await this.initFromNode(parsed.nodeId, parsed.sessionId);
    }

    if (this.state?.status === "exhausted") {
      connection.send(JSON.stringify({
        type: "error",
        message: "This agent is exhausted and read-only.",
      }));
      return;
    }

    // Persist user message
    const msgId = this.saveMessage("user", content);

    // Broadcast user message to all OTHER connections (sender already has it)
    this.broadcast(
      JSON.stringify({
        type: "event",
        event: { type: "text", content },
        role: "user",
        messageId: msgId,
        timestamp: Date.now(),
      }),
      [connection.id], // exclude sender
    );

    // Forward to container instead of calling LLM directly
    await this.forwardToContainer(content, connection);
  }

  onClose(_connection: Connection, _code: number, _reason: string, _wasClean: boolean): void {
    // Only stop containers when the last connection closes
    if ([...this.getConnections()].length === 0) {
      void this.stopAllContainers();
    }
  }

  // ─── Node initialization ──────────────────────────────

  private async initFromNode(nodeId: string, sessionId?: string): Promise<void> {
    try {
      const row = await this.env.DB.prepare(
      `SELECT n.harness_id, n.model, n.status, s.id as session_id,
                s.user_id, u.openrouter_api_key as user_api_key
         FROM agent_node n JOIN agent_session s ON n.session_id = s.id
         JOIN user u ON s.user_id = u.id
         WHERE n.id = ?`
      ).bind(nodeId).first<{
        harness_id: string;
        model: string;
        status: AgentStatusType;
        session_id: string;
        user_id: string;
        user_api_key: string | null;
      }>();

      if (row) {
        this.setState({
          nodeId,
          sessionId: sessionId || row.session_id,
          harnessId: row.harness_id,
          model: row.model,
          status: row.status,
          initialized: true,
        });
      }
    } catch (err) {
      console.error(`[ChatAgent] initFromNode failed:`, err);
    }
  }

  // ─── Container Lifecycle ──────────────────────────────

  private async loadNodeExecutionConfig(
    nodeId: string,
    task: string,
  ): Promise<NodeExecutionConfig> {
    await this.ensureBuiltinHarnesses();

    const row = await this.env.DB.prepare(
      `SELECT n.harness_id, n.model, n.name, s.id as session_id, s.git_repo_url,
              u.openrouter_api_key as user_key,
              h.entry_command as entry_command
         FROM agent_node n
         JOIN agent_session s ON n.session_id = s.id
         JOIN user u ON s.user_id = u.id
         JOIN agent_harness h ON h.id = n.harness_id
        WHERE n.id = ?`,
    ).bind(nodeId).first<{
      harness_id: string;
      model: string;
      name: string;
      session_id: string;
      git_repo_url: string | null;
      user_key: string | null;
      entry_command: string;
    }>();

    if (!row) {
      throw new Error(`Node ${nodeId} not found in D1`);
    }

    const provider = getProviderForModel(row.model);
    const providerDefinition = PROVIDERS[provider];
    let containerApiKey = "";
    const secret = this.getBetterAuthSecret();
    let keySource: ChatAgentState["keySource"];
    if (row.user_key && secret) {
      try {
        const decrypted = await decryptApiKey(row.user_key, secret);
        containerApiKey = deserializeStoredProviderKeys(decrypted)[provider] || '';
        if (containerApiKey) {
          keySource = 'user';
        }
      } catch {
        throw new Error(
          'Stored account router keys are unreadable. Re-save your account keys and try again.',
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
      keySource,
    };
  }

  private buildTurnTask(latestUserMessage: string): string {
    const transcript = this.loadMessages()
      .filter((message) => message.role === "user" || message.role === "assistant")
      .slice(-12)
      .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`)
      .join("\n\n");

    if (!transcript) {
      return latestUserMessage;
    }

    return [
      "Continue this filepath chat session from the transcript below.",
      "Reply only as the selected harness running in the sandbox.",
      "",
      transcript,
      "",
      "Respond to the latest user message in context.",
    ].join("\n");
  }

  private emitAssistantText(nodeId: string, content: string): void {
    const messageId = this.saveMessage("assistant", content);
    this.broadcast(JSON.stringify({
      type: "event",
      event: { type: "text", content },
      role: "assistant",
      messageId,
      nodeId,
      timestamp: Date.now(),
    }));
  }

  private createExecRelay(nodeId: string): {
    onOutput: (stream: "stdout" | "stderr", data: string) => void;
    flush: () => void;
    emitFallbackText: () => void;
    sawStructuredEvent: () => boolean;
    stderrSummary: () => string;
  } {
    let stdoutBuffer = "";
    const rawStdoutLines: string[] = [];
    const stderrChunks: string[] = [];
    let sawStructuredEvent = false;

    return {
      onOutput: (stream, data) => {
        if (stream === "stderr") {
          stderrChunks.push(data);
          console.warn(`[ChatAgent] Container stderr (${nodeId}): ${data.slice(0, 500)}`);
          return;
        }

        stdoutBuffer += data;
        const lines = stdoutBuffer.split(/\r?\n/);
        stdoutBuffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const handled = this.processNDJSONLine(nodeId, trimmed);
          sawStructuredEvent = sawStructuredEvent || handled;
          if (!handled) {
            rawStdoutLines.push(trimmed);
          }
        }
      },
      flush: () => {
        const trimmed = stdoutBuffer.trim();
        stdoutBuffer = "";
        if (!trimmed) return;
        const handled = this.processNDJSONLine(nodeId, trimmed);
        sawStructuredEvent = sawStructuredEvent || handled;
        if (!handled) {
          rawStdoutLines.push(trimmed);
        }
      },
      emitFallbackText: () => {
        if (sawStructuredEvent) return;
        const fallback = rawStdoutLines.join("\n").trim();
        if (fallback) {
          this.emitAssistantText(nodeId, fallback);
        }
      },
      sawStructuredEvent: () => sawStructuredEvent,
      stderrSummary: () => stderrChunks.join("\n").trim(),
    };
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
    } catch (err) {
      console.error(`[ChatAgent] Failed to persist container id for ${nodeId}:`, err);
    }

    const handle: ContainerHandle = {
      sandbox,
      nodeId,
      workspaceRoot,
      activeExecution: false,
    };

    this.containers.set(nodeId, handle);
    console.log(`[ChatAgent] Sandbox ready for node ${nodeId}`);
    return handle;
  }

  private async forwardToContainer(content: string, connection: Connection): Promise<void> {
    const nodeId = this.state?.nodeId;
    if (!nodeId) {
      connection.send(JSON.stringify({ type: 'error', message: 'Node not initialized' }));
      return;
    }

    const task = this.buildTurnTask(content);
    let config: NodeExecutionConfig;
    let handle: ContainerHandle;
    try {
      config = await this.loadNodeExecutionConfig(nodeId, task);
      handle = await this.ensureContainer(nodeId, config.gitRepoUrl);
      if (this.state) {
        this.state.keySource = config.keySource;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ChatAgent] Container preparation failed: ${msg}`);
      this.handleSandboxFailure(
        connection,
        `Could not start the sandbox for this branch: ${msg}`,
      );
      return;
    }

    if (handle.activeExecution) {
      connection.send(JSON.stringify({
        type: "error",
        message: "This agent is already processing a message. Wait for it to finish.",
      }));
      return;
    }

    await this.persistStatus('thinking');
    handle.activeExecution = true;
    const relay = this.createExecRelay(nodeId);

    try {
      const result = await handle.sandbox.exec(config.entryCommand, {
        cwd: handle.workspaceRoot,
        env: config.envVars,
        stream: true,
        onOutput: relay.onOutput,
      });

      relay.flush();
      relay.emitFallbackText();

      if (!result.success) {
        const stderrSummary = relay.stderrSummary() || result.stderr.trim();
        throw new Error(
          stderrSummary
            ? `Sandbox command failed (${result.exitCode}): ${stderrSummary}`
            : `Sandbox command failed (${result.exitCode}).`,
        );
      }

      if (!relay.sawStructuredEvent() && !result.stdout.trim()) {
        throw new Error("Sandbox command completed without producing any agent output.");
      }

      const finalState = this.state?.status;
      if (finalState !== "done" && finalState !== "error" && finalState !== "exhausted") {
        await this.persistStatus("done");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ChatAgent] Sandbox execution failed for ${nodeId}: ${msg}`);
      this.handleSandboxFailure(
        connection,
        `The sandbox runtime failed while handling this message: ${msg}`,
      );
    } finally {
      handle.activeExecution = false;
    }
  }

  private async stopContainer(nodeId: string): Promise<void> {
    const handle = this.containers.get(nodeId);
    if (!handle) return;

    console.log(`[ChatAgent] Stopping container for node ${nodeId}`);
    handle.activeExecution = false;

    this.containers.delete(nodeId);
  }

  private async stopAllContainers(): Promise<void> {
    const nodeIds = Array.from(this.containers.keys());
    await Promise.allSettled(nodeIds.map(id => this.stopContainer(id)));
  }

  // ─── Sandbox Failures ─────────────────────────────────

  private handleSandboxFailure(connection: Connection, reason: string): void {
    const message =
      `${reason}. filepath will not bypass the sandbox with a direct model call. ` +
      "Restart the branch or inspect the container runtime.";
    const messageId = this.saveMessage("assistant", `Warning: ${message}`);

    this.broadcast(JSON.stringify({
      type: "event",
      event: { type: "text", content: `Warning: ${message}` },
      role: "assistant",
      messageId,
      timestamp: Date.now(),
    }));

    void this.persistStatus("error");
    connection.send(JSON.stringify({ type: "error", message }));
  }

  // ─── Helpers ───────────────────────────────────────────

  private async persistStatus(state: AgentStatusType): Promise<void> {
    if (this.state) {
      this.state.status = state;
    }

    if (this.state?.nodeId) {
      await this.env.DB.prepare(
        `UPDATE agent_node SET status = ?, updated_at = unixepoch('subsecond') * 1000 WHERE id = ?`,
      ).bind(state, this.state.nodeId).run();
    }

    this.broadcastStatus(state);
  }

  private broadcastStatus(state: AgentStatusType): void {
    this.broadcast(JSON.stringify({
      type: "event",
      event: { type: "status", state },
      timestamp: Date.now(),
    }));
  }

  /**
   * Parse a single NDJSON line and route it as a FAP event.
   * Invalid lines are logged as raw container output.
   */
  private processNDJSONLine(nodeId: string, line: string): boolean {
    const event = parseAgentEvent(line);

    if (event) {
      this.handleAgentEvent(nodeId, event);
      return true;
    } else {
      console.log(`[ChatAgent] Container output (node ${nodeId}): ${line.slice(0, 500)}`);
      return false;
    }
  }

  /**
   * Handle a validated FAP event from the container.
   *
   * - Text events: persist as assistant message + broadcast with messageId
   * - Tool events: persist summary + broadcast
   * - Spawn events: log only (implementation deferred)
   * - All other events: broadcast to WS clients
   */
  private handleAgentEvent(nodeId: string, event: AgentEventType): void {
    const timestamp = Date.now();

    // Text events → persist as assistant messages
    if (event.type === "text") {
      const msgId = this.saveMessage("assistant", event.content);
      this.broadcast(JSON.stringify({
        type: "event",
        event,
        role: "assistant",
        messageId: msgId,
        nodeId,
        timestamp,
      }));
      return;
    }

    // Tool events → persist a summary line + broadcast
    if (event.type === "tool") {
      const summary = `[tool:${event.name}] ${event.status}${event.path ? ` ${event.path}` : ""}`;
      this.saveMessage("assistant", summary);
      this.broadcast(JSON.stringify({
        type: "event",
        event,
        nodeId,
        timestamp,
      }));
      return;
    }

    // Spawn events → log (not yet wired to node creation)
    if (event.type === "spawn") {
      console.log(
        `[ChatAgent] Spawn request from node ${nodeId}: ` +
        `agent=${event.agent} name=${event.name} task=${event.task ?? "(none)"}`,
      );
    }

    if (event.type === "status") {
      void this.persistStatus(event.state);
      if (event.state === "exhausted") {
        void this.stopContainer(nodeId);
      }
      return;
    }

    if (event.type === "done") {
      if (event.summary) {
        this.saveMessage("assistant", event.summary);
      }
      void this.persistStatus("done");
    }

    if (event.type === "handoff") {
      this.saveMessage("assistant", `Exhausted: ${event.summary}`);
      void this.persistStatus("exhausted");
      void this.stopContainer(nodeId);
    }

    // Broadcast all valid events to connected WS clients
    this.broadcast(JSON.stringify({
      type: "event",
      event,
      nodeId,
      timestamp,
    }));
  }

  // ─── REST API (message history) ────────────────────────

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // GET /messages — return full chat history
    if (request.method === "GET" && url.pathname.endsWith("/messages")) {
      const messages = this.loadMessages();
      return new Response(JSON.stringify({ messages }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Default: let Agent handle WebSocket upgrade
    return new Response("Not found", { status: 404 });
  }
}
