import { Agent } from "agents";
import type { Connection, ConnectionContext, WSMessage } from "agents";
import type { Env } from "../types";

/**
 * ChatAgent — Durable Object for a single agent node.
 *
 * Responsibilities:
 * 1. Persist chat messages in DO SQLite (survives restarts)
 * 2. Relay messages between connected WebSocket clients (real-time sync)
 * 3. Call LLM directly via OpenRouter/OpenAI
 * 4. Eventually: manage a Container for agent execution
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

export class ChatAgent extends Agent<Env, ChatAgentState> {
  private schemaReady = false;

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

    // Call LLM
    await this.callLLM(content, connection);
  }

  onClose(_connection: Connection, _code: number, _reason: string, _wasClean: boolean): void {
    // Connection cleanup handled by base class
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

    // Resolve provider + model
    const { apiUrl, apiKey, model, headers } = this.resolveProvider();

    if (!apiKey) {
      const errMsg = "No API key configured (OPENROUTER_API_KEY or OPENAI_API_KEY).";
      this.saveMessage("assistant", `⚠️ ${errMsg}`);
      connection.send(JSON.stringify({ type: "error", message: errMsg }));
      this.broadcastStatus("idle");
      return;
    }

    try {
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

      // Fallback: if OpenRouter fails and we have OpenAI key, try that
      if (!response.ok && apiUrl.includes("openrouter") && this.env.OPENAI_API_KEY) {
        const fallbackModel = this.openaiModel();
        response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${this.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: fallbackModel,
            messages: [{ role: "system", content: this.systemPrompt() }, ...llmMessages],
            stream: false,
          }),
        });
      }

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

  private systemPrompt(): string {
    const agentType = this.state?.agentType || "shelley";
    const model = this.state?.model || "unknown";
    return `You are a helpful AI assistant running on filepath, an agent orchestration platform. You are agent type "${agentType}" using model "${model}". Be concise and helpful.`;
  }

  private resolveProvider(): { apiUrl: string; apiKey: string; model: string; headers: Record<string, string> } {
    const rawModel = this.state?.model || "claude-sonnet-4";

    // Try OpenRouter first
    if (this.env.OPENROUTER_API_KEY) {
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

    // Fallback to OpenAI
    return {
      apiUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: this.env.OPENAI_API_KEY || "",
      model: this.openaiModel(),
      headers: {},
    };
  }

  private openaiModel(): string {
    const m = this.state?.model || "claude-sonnet-4";
    const map: Record<string, string> = {
      "claude-sonnet-4": "gpt-4o",
      "claude-opus-4-6": "gpt-4o",
      "gpt-4o": "gpt-4o",
      "o3": "o3",
      "deepseek-r1": "gpt-4o",
      "gemini-2.5-pro": "gpt-4o",
    };
    return map[m] || "gpt-4o";
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
