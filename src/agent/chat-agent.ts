import { Agent } from "agents";
import type { Connection, ConnectionContext, WSMessage } from "agents";
import type { Env } from "../types";
import { parseAgentEvent } from "../lib/protocol";
import type { AgentEventType } from "../lib/protocol";
import { getSandbox, type Sandbox } from '@cloudflare/sandbox';
import { ADAPTER_COMMANDS, buildAgentEnv } from '$lib/agents/adapters';
import type { AgentType } from '$lib/types/session';

/**
 * ChatAgent — Durable Object for a single agent node.
 *
 * Responsibilities:
 * 1. Persist chat messages in DO SQLite (survives restarts)
 * 2. Relay messages between connected WebSocket clients (real-time sync)
 * 3. Spawn + manage containers for agent execution (primary path)
 * 4. Fall back to direct LLM call if container spawn fails
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
        `SELECT n.agent_type, n.model, s.id as session_id
         FROM agent_node n JOIN agent_session s ON n.session_id = s.id
         WHERE n.id = ?`
      ).bind(nodeId).first<{
        agent_type: string;
        model: string;
        session_id: string;
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
      `SELECT n.agent_type, n.model, n.name, s.id as session_id
       FROM agent_node n JOIN agent_session s ON n.session_id = s.id
       WHERE n.id = ?`
    ).bind(nodeId).first<{
      agent_type: string;
      model: string;
      name: string;
      session_id: string;
    }>();

    if (!row) throw new Error(`Node ${nodeId} not found in D1`);

    console.log(`[ChatAgent] Spawning container for node ${nodeId} (${row.agent_type})`);

    const sandbox = getSandbox(this.env.Sandbox as unknown as Parameters<typeof getSandbox>[0], nodeId);

    const envVars: Record<string, string> = {
      ...buildAgentEnv({
        agentType: row.agent_type as AgentType,
        model: row.model,
        apiKey: this.env.OPENROUTER_API_KEY || '',
        task: row.name || '',
        workspacePath: '/workspace',
      }),
      FILEPATH_AGENT_ID: nodeId,
      FILEPATH_SESSION_ID: row.session_id,
    };

    const command = ADAPTER_COMMANDS[row.agent_type] ?? ADAPTER_COMMANDS['shelley'];
    const proc = await sandbox.startProcess(command, {
      env: envVars,
      cwd: '/workspace',
    }) as unknown as ContainerProcess;

    const abortController = new AbortController();
    const handle: ContainerHandle = {
      sandbox,
      nodeId,
      stdinWriter: proc.stdin ? proc.stdin.getWriter() : null,
      abortController,
    };

    this.containers.set(nodeId, handle);

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
        // Fall back to direct LLM call
        await this.callLLM(content, connection);
        return;
      }
    }

    const handle = this.containers.get(nodeId);
    if (!handle?.stdinWriter) {
      // No stdin available, fall back to direct LLM
      console.warn(`[ChatAgent] No stdin writer for container ${nodeId}, falling back to LLM`);
      await this.callLLM(content, connection);
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
      // Container may have crashed — clean up and fall back
      await this.stopContainer(nodeId);
      await this.callLLM(content, connection);
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

  // ─── LLM ──────────────────────────────────────────────

  private async callLLM(userMessage: string, connection: Connection): Promise<void> {
    // Broadcast thinking status
    this.broadcast(JSON.stringify({
      type: "event",
      event: { type: "status", state: "thinking" },
      timestamp: Date.now(),
    }));

    // Build conversation from persisted messages
    const history = this.loadMessages();
    const llmMessages = history.map(m => ({ role: m.role, content: m.content }));

    try {
      // Resolve provider + model
      const { apiUrl, apiKey, model, headers } = this.resolveProvider();

      if (!apiKey) {
        const errMsg = "No OPENROUTER_API_KEY configured.";
        this.saveMessage("assistant", `⚠️ ${errMsg}`);
        connection.send(JSON.stringify({ type: "error", message: errMsg }));
        this.broadcastStatus("idle");
        return;
      }

      let response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: this.systemPrompt() },
            ...llmMessages,
          ],
          stream: false,
        }),
      });


      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`${response.status}: ${errText.slice(0, 200)}`);
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const reply = data.choices?.[0]?.message?.content || "(no response)";

      // Persist assistant message
      const replyId = this.saveMessage("assistant", reply);

      // Broadcast response to all clients
      this.broadcast(JSON.stringify({
        type: "event",
        event: { type: "text", content: reply },
        role: "assistant",
        messageId: replyId,
        timestamp: Date.now(),
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ChatAgent] LLM error: ${msg}`);
      this.saveMessage("assistant", `⚠️ LLM error: ${msg}`);
      connection.send(JSON.stringify({ type: "error", message: `LLM error: ${msg}` }));
    }

    this.broadcastStatus("idle");
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

  private systemPrompt(): string {
    const agentType = this.state?.agentType || "shelley";
    const model = this.state?.model || "unknown";
    return `You are a helpful AI assistant running on filepath, an agent orchestration platform. You are agent type "${agentType}" using model "${model}". Be concise and helpful.`;
  }

  private resolveProvider(): { apiUrl: string; apiKey: string; model: string; headers: Record<string, string> } {
    const rawModel = this.state?.model || "claude-sonnet-4";

    // OpenRouter is required — no fallback
    if (!this.env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is required");
    }

    const modelMap: Record<string, string> = {
      "claude-sonnet-4": "anthropic/claude-sonnet-4",
      "claude-opus-4-6": "anthropic/claude-opus-4",
      "gpt-4o": "openai/gpt-4o",
      "o3": "openai/o3",
      "deepseek-r1": "deepseek/deepseek-r1",
      "gemini-2.5-pro": "google/gemini-2.5-pro-preview",
    };

    return {
      apiUrl: "https://openrouter.ai/api/v1/chat/completions",
      apiKey: this.env.OPENROUTER_API_KEY,
      model: modelMap[rawModel] || rawModel,
      headers: { "HTTP-Referer": "https://myfilepath.com", "X-Title": "filepath" },
    };
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
