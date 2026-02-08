import { AIChatAgent } from "@cloudflare/ai-chat";
import { getSandbox } from "@cloudflare/sandbox";
import type { Env } from "../types";
import {
  parseAgentEvent,
  serializeInput,
} from "$lib/protocol";
import type { AgentEventType, UserMessageType } from "$lib/protocol";

/**
 * State stored in the DO for this chat agent instance.
 * Tracks the associated node, session, and container.
 */
export interface ChatAgentState {
  nodeId: string;
  sessionId: string;
  agentType: string;
  model: string;
  containerId?: string;
}

/**
 * ChatAgent -- Durable Object that acts as a relay between frontend and container.
 *
 * It does NOT call LLMs directly. Instead:
 * 1. Receives user messages from frontend via WebSocket
 * 2. Forwards them to container process via stdin (NDJSON)
 * 3. Reads container stdout, parses NDJSON events
 * 4. Persists events as message history
 * 5. Streams events to frontend via WebSocket
 */
export class ChatAgent extends AIChatAgent<Env, ChatAgentState> {
  /** Active WebSocket connections from frontends */
  private wsClients: Set<WebSocket> = new Set();

  /** Get the container ID (if running) */
  get containerId(): string | undefined {
    return this.state?.containerId;
  }

  /**
   * Handle incoming WebSocket connections.
   * Frontend connects here to send/receive messages.
   */
  async onConnect(connection: WebSocket): Promise<void> {
    this.wsClients.add(connection);

    // Send existing message history
    for (const msg of this.messages) {
      connection.send(JSON.stringify(msg));
    }
  }

  async onClose(connection: WebSocket): Promise<void> {
    this.wsClients.delete(connection);
  }

  /**
   * Broadcast a message to all connected frontends.
   */
  private broadcast(data: unknown): void {
    const payload = JSON.stringify(data);
    for (const ws of this.wsClients) {
      try {
        ws.send(payload);
      } catch {
        this.wsClients.delete(ws);
      }
    }
  }

  /**
   * Called by the SDK when the client sends a chat message.
   * Instead of calling an LLM, we forward the message to the container.
   */
  async onChatMessage(
    onFinish: (event: unknown) => Promise<void>,
    options?: { abortSignal?: AbortSignal },
  ): Promise<Response> {
    const agentState = this.state;
    const lastMessage = this.messages[this.messages.length - 1];

    if (!lastMessage) {
      return new Response("No message to process", { status: 400 });
    }

    // Extract text from the last message
    const text =
      lastMessage.parts
        ?.filter((p: { type: string }) => p.type === "text")
        .map((p: { text?: string }) => p.text ?? "")
        .join("") ?? "";

    if (!text) {
      return new Response("Empty message", { status: 400 });
    }

    // If container is running, forward the message via stdin
    const cid = agentState?.containerId;
    if (cid) {
      try {
        await this.sendToContainer(cid, {
          type: "message",
          from: "user",
          content: text,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[ChatAgent] Failed to send to container: ${msg}`);
        return new Response(
          `Container communication error: ${msg}`,
          { headers: { "Content-Type": "text/plain" } },
        );
      }
    } else {
      // No container -- return a message indicating agent needs to be started
      return new Response(
        "Agent container is not running. Start the agent first.",
        { headers: { "Content-Type": "text/plain" } },
      );
    }

    // Acknowledge -- actual responses will come via stdout event stream
    return new Response("Message forwarded to agent", {
      headers: { "Content-Type": "text/plain" },
    });
  }

  /**
   * Send a message to the container process via stdin.
   */
  private async sendToContainer(
    containerId: string,
    input: UserMessageType,
  ): Promise<void> {
    const sandbox = getSandbox(
      this.env.Sandbox as Parameters<typeof getSandbox>[0],
      containerId,
    );

    const line = serializeInput(input) + "\n";
    await sandbox.exec(`echo '${line.replace(/'/g, "'\\''")}'`, {
      cwd: "/workspace",
      timeout: 5000,
    });
  }

  /**
   * Start the agent container and begin reading stdout.
   * Called when a session transitions to "running".
   */
  async startContainer(config: {
    agentType: string;
    model: string;
    gitRepoUrl?: string;
    task?: string;
    nodeId: string;
    sessionId: string;
  }): Promise<{ containerId: string }> {
    const sandbox = getSandbox(
      this.env.Sandbox as Parameters<typeof getSandbox>[0],
    );

    // Clone repo if specified
    if (config.gitRepoUrl) {
      try {
        await sandbox.exec(
          `git clone ${config.gitRepoUrl} /workspace`,
          { cwd: "/", timeout: 60000 },
        );
      } catch (err) {
        console.warn(`[ChatAgent] Git clone failed: ${err}`);
      }
    }

    // Store state
    const containerId = crypto.randomUUID();
    this.setState({
      nodeId: config.nodeId,
      sessionId: config.sessionId,
      agentType: config.agentType,
      model: config.model,
      containerId,
    });

    // Update D1 with container ID
    try {
      await this.env.DB.prepare(
        "UPDATE agent_node SET container_id = ?, status = 'running' WHERE id = ?",
      )
        .bind(containerId, config.nodeId)
        .run();
    } catch (err) {
      console.error("[ChatAgent] Failed to update node:", err);
    }

    console.log(
      `[ChatAgent] Container started: ${containerId} for node ${config.nodeId}`,
    );

    return { containerId };
  }

  /**
   * Process a line of NDJSON stdout from the container.
   * Validates, persists, and broadcasts to connected frontends.
   */
  async processStdoutLine(line: string): Promise<void> {
    const event = parseAgentEvent(line);
    if (!event) {
      console.warn(`[ChatAgent] Invalid event line: ${line.slice(0, 100)}`);
      return;
    }

    // Broadcast to all connected frontends
    this.broadcast({
      type: "event",
      event,
      messageId: crypto.randomUUID(),
      timestamp: Date.now(),
    });

    // Handle special events
    await this.handleSpecialEvent(event);
  }

  /**
   * Handle events that require DO-level action.
   */
  private async handleSpecialEvent(event: AgentEventType): Promise<void> {
    const agentState = this.state;
    if (!agentState) return;

    switch (event.type) {
      case "status": {
        try {
          await this.env.DB.prepare(
            "UPDATE agent_node SET status = ? WHERE id = ?",
          )
            .bind(event.state, agentState.nodeId)
            .run();
        } catch (err) {
          console.error("[ChatAgent] Failed to update status:", err);
        }
        break;
      }

      case "done": {
        try {
          await this.env.DB.prepare(
            "UPDATE agent_node SET status = 'done' WHERE id = ?",
          )
            .bind(agentState.nodeId)
            .run();
        } catch (err) {
          console.error("[ChatAgent] Failed to mark done:", err);
        }
        break;
      }

      case "spawn": {
        try {
          const childId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
          await this.env.DB.prepare(
            `INSERT INTO agent_node (id, session_id, parent_id, name, agent_type, model, status, config, sort_order, tokens)
             VALUES (?, ?, ?, ?, ?, ?, 'idle', '{}', 0, 0)`,
          )
            .bind(
              childId,
              agentState.sessionId,
              agentState.nodeId,
              event.name,
              event.agent,
              event.model,
            )
            .run();

          this.broadcast({
            type: "tree_update",
            action: "spawn",
            node: {
              id: childId,
              sessionId: agentState.sessionId,
              parentId: agentState.nodeId,
              name: event.name,
              agentType: event.agent,
              model: event.model,
              status: "idle",
            },
          });
        } catch (err) {
          console.error("[ChatAgent] Failed to spawn child:", err);
        }
        break;
      }

      case "handoff": {
        console.log(
          `[ChatAgent] Handoff for node ${agentState.nodeId}: ${event.summary}`,
        );
        try {
          await this.env.DB.prepare(
            "UPDATE agent_node SET status = 'done' WHERE id = ?",
          )
            .bind(agentState.nodeId)
            .run();
        } catch (err) {
          console.error("[ChatAgent] Handoff status update failed:", err);
        }
        break;
      }
    }
  }

  /**
   * Stop the container and clean up.
   */
  async stopContainer(): Promise<void> {
    const agentState = this.state;
    if (!agentState?.containerId) return;

    try {
      await this.sendToContainer(agentState.containerId, {
        type: "signal",
        action: "stop",
      } as unknown as UserMessageType);
    } catch {
      // Container may already be stopped
    }

    try {
      await this.env.DB.prepare(
        "UPDATE agent_node SET status = 'idle', container_id = NULL WHERE id = ?",
      )
        .bind(agentState.nodeId)
        .run();
    } catch (err) {
      console.error("[ChatAgent] Failed to update on stop:", err);
    }

    this.setState({
      ...agentState,
      containerId: undefined,
    });

    console.log(
      `[ChatAgent] Container stopped for node ${agentState.nodeId}`,
    );
  }
}
