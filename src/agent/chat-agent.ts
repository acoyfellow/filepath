import { Agent } from "agents";
import type { Connection, ConnectionContext, WSMessage } from "agents";
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
export class ChatAgent extends Agent<Env, ChatAgentState> {
  /** Get the container ID (if running) */
  get containerId(): string | undefined {
    return this.state?.containerId;
  }

  /**
   * Handle incoming WebSocket connections.
   * Frontend connects here to send/receive messages.
   */
  onConnect(
    connection: Connection,
    ctx: ConnectionContext,
  ): void | Promise<void> {
    // History is loaded from D1 on the frontend side.
    // The DO just relays live events.
  }

  onClose(
    connection: Connection,
    code: number,
    reason: string,
    wasClean: boolean,
  ): void | Promise<void> {
    // Connection cleanup handled by base class
  }

  /**
   * Handle incoming WebSocket messages from the frontend.
   * Parses the message and forwards it to the container.
   */
  onMessage(connection: Connection, message: WSMessage): void | Promise<void> {
    let text: string;
    if (typeof message === "string") {
      text = message;
    } else if (message instanceof ArrayBuffer) {
      text = new TextDecoder().decode(message);
    } else {
      text = new TextDecoder().decode(message);
    }

    let parsed: { type?: string; content?: string };
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { type: "message", content: text };
    }

    const content = parsed.content ?? text;
    if (!content) return;

    const cid = this.state?.containerId;
    if (cid) {
      this.sendToContainer(cid, {
        type: "message",
        from: "user",
        content,
      }).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[ChatAgent] Failed to send to container: ${msg}`);
        connection.send(
          JSON.stringify({
            type: "error",
            message: `Container communication error: ${msg}`,
          }),
        );
      });
    } else {
      connection.send(
        JSON.stringify({
          type: "error",
          message: "Agent container is not running. Start the agent first.",
        }),
      );
    }
  }

  /**
   * Send a message to the container process via stdin.
   */
  private async sendToContainer(
    containerId: string,
    input: UserMessageType,
  ): Promise<void> {
    const sandbox = getSandbox(
      this.env.Sandbox as unknown as Parameters<typeof getSandbox>[0],
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
    const containerId = crypto.randomUUID();
    const sandbox = getSandbox(
      this.env.Sandbox as unknown as Parameters<typeof getSandbox>[0],
      containerId,
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
    this.broadcast(
      JSON.stringify({
        type: "event",
        event,
        messageId: crypto.randomUUID(),
        timestamp: Date.now(),
      }),
    );

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

          this.broadcast(
            JSON.stringify({
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
            }),
          );
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
