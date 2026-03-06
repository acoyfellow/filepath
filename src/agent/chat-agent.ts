import { Agent } from "agents";
import type { Connection, ConnectionContext, WSMessage } from "agents";
import type { Env } from "../types";
import { parseAgentEvent } from "../lib/protocol";
import type { AgentEventType } from "../lib/protocol";
import { getSandbox, type Sandbox } from '@cloudflare/sandbox';
import { buildAgentEnv } from '$lib/agents/adapters';
import { cloneRepo, resolveWorkspaceRoot, type ContainerEnv } from '$lib/agents/container';
import type { AgentType } from '$lib/types/session';
import { decryptApiKey } from '$lib/crypto';
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
  agentType: string;
  model: string;
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

/** Minimal interface for a container process with stdout/stdin streams */
interface ContainerProcess {
  stdout: ReadableStream<Uint8Array>;
  stdin?: WritableStream<Uint8Array>;
  pid?: number;
}

/** Handle for a spawned container with lifecycle management */
interface ContainerHandle {
  sandbox: Sandbox;
  nodeId: string;
  stdinWriter: WritableStreamDefaultWriter<Uint8Array> | null;
  abortController: AbortController;
}

export class ChatAgent extends Agent<Env, ChatAgentState> {
  private schemaReady = false;
  private containers: Map<string, ContainerHandle> = new Map();

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

  // ─── WebSocket lifecycle ──────────────────────────────

  onConnect(connection: Connection, _ctx: ConnectionContext): void {
    // Send full message history to newly connected client
    const messages = this.loadMessages();
    connection.send(JSON.stringify({
      type: "history",
      messages: messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
      })),
    }));

    // Send current status
    connection.send(JSON.stringify({
      type: "event",
      event: { type: "status", state: "idle" },
      timestamp: Date.now(),
    }));
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
        `SELECT n.agent_type, n.model, s.id as session_id, s.api_key as session_api_key,
                s.user_id, u.openrouter_api_key as user_api_key
         FROM agent_node n JOIN agent_session s ON n.session_id = s.id
         JOIN user u ON s.user_id = u.id
         WHERE n.id = ?`
      ).bind(nodeId).first<{
        agent_type: string;
        model: string;
        session_id: string;
        session_api_key: string | null;
        user_id: string;
        user_api_key: string | null;
      }>();

      if (row) {
        this.setState({
          nodeId,
          sessionId: sessionId || row.session_id,
          agentType: row.agent_type,
          model: row.model,
          initialized: true,
        });
      }
    } catch (err) {
      console.error(`[ChatAgent] initFromNode failed:`, err);
    }
  }

  // ─── Container Lifecycle ──────────────────────────────

  private async spawnContainer(nodeId: string): Promise<void> {
    // Get node config from D1
    const row = await this.env.DB.prepare(
      `SELECT n.agent_type, n.model, n.name, s.id as session_id, s.git_repo_url,
              s.api_key as session_key, u.openrouter_api_key as user_key,
              h.entry_command as entry_command
         FROM agent_node n
         JOIN agent_session s ON n.session_id = s.id
         JOIN user u ON s.user_id = u.id
         JOIN agent_harness h ON h.id = n.agent_type
        WHERE n.id = ?`,
    ).bind(nodeId).first<{
      agent_type: string;
      model: string;
      name: string;
      session_id: string;
      git_repo_url: string | null;
      session_key: string | null;
      user_key: string | null;
      entry_command: string;
    }>();

    if (!row) throw new Error(`Node ${nodeId} not found in D1`);

    console.log(`[ChatAgent] Spawning container for node ${nodeId} (${row.agent_type})`);

    // Resolve API key for the container
    const provider = getProviderForModel(row.model);
    const providerDefinition = PROVIDERS[provider];
    let containerApiKey = '';
    const secret = this.env.BETTER_AUTH_SECRET;
    let keySource: ChatAgentState["keySource"];
    if (row.session_key && secret) {
      try {
        containerApiKey = await decryptApiKey(row.session_key, secret);
        keySource = 'session';
      } catch {
        throw new Error('Session API key is unreadable. Rotate this session key and try again.');
      }
    }
    if (!containerApiKey && row.user_key && secret) {
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
    const sandbox = getSandbox(this.env.Sandbox as unknown as Parameters<typeof getSandbox>[0], nodeId);

    const workspaceRoot = resolveWorkspaceRoot(row.git_repo_url);

    // Clone git repo if specified (before starting agent process)
    if (row.git_repo_url) {
      console.log(`[ChatAgent] Cloning repo: ${row.git_repo_url}`);
      await cloneRepo(
        { Sandbox: this.env.Sandbox } as unknown as ContainerEnv,
        nodeId,
        row.git_repo_url,
        workspaceRoot
      );
    }

    const envVars: Record<string, string> = {
      ...buildAgentEnv({
        agentType: row.agent_type as AgentType,
        model: canonicalizeStoredModel(row.model),
        apiKey: containerApiKey,
        task: row.name || '',
        workspacePath: workspaceRoot,
      }),
      FILEPATH_AGENT_ID: nodeId,
      FILEPATH_SESSION_ID: row.session_id,
    };

    if (!row.entry_command) {
      throw new Error(`Harness ${row.agent_type} has no entry command.`);
    }

    const proc = await sandbox.startProcess(row.entry_command, {
      env: envVars,
      cwd: workspaceRoot,
    }) as unknown as ContainerProcess;

    try {
      await this.env.DB.prepare(
        `UPDATE agent_node SET container_id = ?, updated_at = unixepoch('subsecond') * 1000 WHERE id = ?`,
      ).bind(nodeId, nodeId).run();
    } catch (err) {
      console.error(`[ChatAgent] Failed to persist container id for ${nodeId}:`, err);
    }

    const abortController = new AbortController();
    const handle: ContainerHandle = {
      sandbox,
      nodeId,
      stdinWriter: proc.stdin ? proc.stdin.getWriter() : null,
      abortController,
    };

    this.containers.set(nodeId, handle);
    if (this.state) {
      this.state.keySource = keySource;
    }

    // Set up stdout relay in the background
    this.setupContainerRelay(nodeId, proc);

    this.broadcastStatus('running');
    console.log(`[ChatAgent] Container spawned for node ${nodeId}`);
  }

  private async forwardToContainer(content: string, connection: Connection): Promise<void> {
    const nodeId = this.state?.nodeId;
    if (!nodeId) {
      connection.send(JSON.stringify({ type: 'error', message: 'Node not initialized' }));
      return;
    }

    // Spawn container if not already running
    if (!this.containers.has(nodeId)) {
      try {
        await this.spawnContainer(nodeId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[ChatAgent] Container spawn failed: ${msg}`);
        this.handleSandboxFailure(
          connection,
          `Could not start the sandbox for this branch: ${msg}`,
        );
        return;
      }
    }

    const handle = this.containers.get(nodeId);
    if (!handle?.stdinWriter) {
      console.warn(`[ChatAgent] No stdin writer for container ${nodeId}`);
      this.handleSandboxFailure(
        connection,
        "This branch has no live stdin pipe to its sandbox process",
      );
      return;
    }

    this.broadcastStatus('thinking');

    const inputMsg = JSON.stringify({ type: 'message', from: 'user', content }) + '\n';
    const encoded = new TextEncoder().encode(inputMsg);

    try {
      await handle.stdinWriter.write(encoded);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ChatAgent] Failed to write to container stdin: ${msg}`);
      // Container may have crashed — clean up and fail explicitly.
      await this.stopContainer(nodeId);
      this.handleSandboxFailure(
        connection,
        `The sandbox process stopped accepting input: ${msg}`,
      );
    }
  }

  private async stopContainer(nodeId: string): Promise<void> {
    const handle = this.containers.get(nodeId);
    if (!handle) return;

    console.log(`[ChatAgent] Stopping container for node ${nodeId}`);
    handle.abortController.abort();

    if (handle.stdinWriter) {
      try {
        await handle.stdinWriter.close();
      } catch {
        // Writer may already be closed
      }
    }

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
    const messageId = this.saveMessage("assistant", `⚠️ ${message}`);

    this.broadcast(JSON.stringify({
      type: "event",
      event: { type: "text", content: `⚠️ ${message}` },
      role: "assistant",
      messageId,
      timestamp: Date.now(),
    }));

    this.broadcastStatus("error");
    connection.send(JSON.stringify({ type: "error", message }));
  }

  // ─── Helpers ───────────────────────────────────────────

  private broadcastStatus(state: string): void {
    this.broadcast(JSON.stringify({
      type: "event",
      event: { type: "status", state },
      timestamp: Date.now(),
    }));
  }

  // ─── Container Relay (NDJSON stdout → WS clients) ─────

  /**
   * Read NDJSON from container stdout, validate as FAP events,
   * and broadcast to WebSocket clients.
   *
   * Handles partial lines across chunk boundaries.
   * Invalid lines are logged but never crash the relay.
   */
  setupContainerRelay(nodeId: string, container: ContainerProcess): void {
    const reader = container.stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const processStream = async (): Promise<void> => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) {
            // Flush remaining buffer on stream close
            if (buffer.trim()) {
              this.processNDJSONLine(nodeId, buffer.trim());
            }
            console.log(`[ChatAgent] Container stdout closed for node ${nodeId}`);
            this.broadcastStatus("done");
            break;
          }

          // Decode chunk, preserving partial multi-byte chars across reads
          buffer += decoder.decode(value, { stream: true });

          // Split by newlines — NDJSON is one JSON object per line
          const lines = buffer.split("\n");
          // Last element is either "" (line ended with \n) or a partial line
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            this.processNDJSONLine(nodeId, trimmed);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[ChatAgent] Container relay error for node ${nodeId}: ${msg}`);
        this.broadcastStatus("error");
      }
    };

    // Fire-and-forget: stream processing runs in background
    processStream().catch((err) => {
      console.error(`[ChatAgent] Unhandled relay error:`, err);
    });
  }

  /**
   * Parse a single NDJSON line and route it as a FAP event.
   * Invalid lines are logged as raw container output.
   */
  private processNDJSONLine(nodeId: string, line: string): void {
    const event = parseAgentEvent(line);

    if (event) {
      this.handleAgentEvent(nodeId, event);
    } else {
      // Not a valid FAP event — log as raw container output
      console.log(`[ChatAgent] Container output (node ${nodeId}): ${line.slice(0, 500)}`);
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
