import { Agent } from "agents";
import type { Connection, ConnectionContext, WSMessage } from "agents";
import { getSandbox } from "@cloudflare/sandbox";
import type { Env } from "../types";
import {
  parseAgentEvent,
  serializeInput,
} from "$lib/protocol";
import type { AgentEventType, UserMessageType } from "$lib/protocol";
import { ADAPTER_COMMANDS, buildAgentEnv } from "$lib/agents/adapters";
import type { AdapterConfig } from "$lib/agents/adapters";

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

  /** Message history for direct LLM mode */
  private chatHistory: Array<{ role: string; content: string }> = [];

  /**
   * Handle incoming WebSocket messages from the frontend.
   * Parses the message and either forwards to container or calls LLM directly.
   */
  async onMessage(connection: Connection, message: WSMessage): Promise<void> {
    let text: string;
    if (typeof message === "string") {
      text = message;
    } else if (message instanceof ArrayBuffer) {
      text = new TextDecoder().decode(message);
    } else {
      text = new TextDecoder().decode(message);
    }

    let parsed: { type?: string; content?: string; nodeId?: string; sessionId?: string };
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { type: "message", content: text };
    }

    const content = parsed.content ?? text;
    if (!content) return;

    // Store nodeId/sessionId from first message
    if (!this.state?.nodeId && parsed.nodeId) {
      await this.initFromNode(parsed.nodeId, parsed.sessionId);
    }

    // If container is running, forward to it
    if (this.state?.containerId) {
      this.sendToContainer(this.state.containerId, {
        type: "message",
        from: "user",
        content,
      }).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[ChatAgent] Failed to send to container: ${msg}`);
        // Fall back to direct LLM
        this.callLLMDirect(content, connection).catch(console.error);
      });
      return;
    }

    // No container — call LLM directly (demo mode)
    await this.callLLMDirect(content, connection);
  }

  /**
   * Initialize state from D1 node lookup.
   */
  private async initFromNode(nodeId: string, sessionId?: string): Promise<void> {
    try {
      const row = await this.env.DB.prepare(
        `SELECT n.agent_type, n.model, n.config, s.id as session_id
         FROM agent_node n JOIN agent_session s ON n.session_id = s.id
         WHERE n.id = ?`
      ).bind(nodeId).first<{
        agent_type: string;
        model: string;
        config: string;
        session_id: string;
      }>();

      if (row) {
        this.setState({
          nodeId,
          sessionId: sessionId || row.session_id,
          agentType: row.agent_type,
          model: row.model,
        });
      }
    } catch (err) {
      console.error(`[ChatAgent] initFromNode failed:`, err);
    }
  }

  /**
   * Call LLM directly via OpenRouter (fallback when no container).
   */
  private async callLLMDirect(userMessage: string, connection: Connection): Promise<void> {
    // Broadcast thinking status
    this.broadcast(JSON.stringify({
      type: "event",
      event: { type: "status", state: "thinking" },
      messageId: crypto.randomUUID(),
      timestamp: Date.now(),
    }));

    // Add to history
    this.chatHistory.push({ role: "user", content: userMessage });

    // Try OpenRouter first, fall back to OpenAI
    const openrouterKey = this.env.OPENROUTER_API_KEY;
    const openaiKey = this.env.OPENAI_API_KEY;
    
    if (!openrouterKey && !openaiKey) {
      connection.send(JSON.stringify({
        type: "error",
        message: "No API keys configured. Set OPENROUTER_API_KEY or OPENAI_API_KEY.",
      }));
      return;
    }

    // Resolve model for the chosen provider
    const useOpenAI = !openrouterKey;
    const model = useOpenAI ? this.resolveOpenAIModel() : this.resolveModel();
    const apiUrl = useOpenAI 
      ? "https://api.openai.com/v1/chat/completions"
      : "https://openrouter.ai/api/v1/chat/completions";
    const apiKey = useOpenAI ? openaiKey! : openrouterKey!;

    try {
      let response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(useOpenAI ? {} : { "HTTP-Referer": "https://myfilepath.com", "X-Title": "filepath" }),
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: `You are a helpful AI assistant running on filepath, an agent orchestration platform. You are agent type "${this.state?.agentType || 'shelley'}" using model "${model}". Be concise and helpful.`,
            },
            ...this.chatHistory,
          ],
          stream: false,
        }),
      });

      // If OpenRouter fails, try OpenAI as fallback
      if (!response.ok && !useOpenAI && openaiKey) {
        const fallbackModel = this.resolveOpenAIModel();
        response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: fallbackModel,
            messages: [
              {
                role: "system",
                content: `You are a helpful AI assistant running on filepath, an agent orchestration platform. You are agent type "${this.state?.agentType || 'shelley'}" using model "${fallbackModel}". Be concise and helpful.`,
              },
              ...this.chatHistory,
            ],
            stream: false,
          }),
        });
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenRouter ${response.status}: ${errText.slice(0, 200)}`);
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const reply = data.choices?.[0]?.message?.content || "(no response)";

      // Add to history
      this.chatHistory.push({ role: "assistant", content: reply });

      // Broadcast the text response
      this.broadcast(JSON.stringify({
        type: "event",
        event: { type: "text", content: reply },
        messageId: crypto.randomUUID(),
        timestamp: Date.now(),
      }));

      // Broadcast idle status
      this.broadcast(JSON.stringify({
        type: "event",
        event: { type: "status", state: "idle" },
        messageId: crypto.randomUUID(),
        timestamp: Date.now(),
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ChatAgent] LLM call failed: ${msg}`);
      connection.send(JSON.stringify({
        type: "error",
        message: `LLM error: ${msg}`,
      }));

      // Set status back to idle on error
      this.broadcast(JSON.stringify({
        type: "event",
        event: { type: "status", state: "idle" },
        messageId: crypto.randomUUID(),
        timestamp: Date.now(),
      }));
    }
  }

  /**
   * Resolve the OpenRouter model string from state.
   */
  private resolveModel(): string {
    const model = this.state?.model || "claude-sonnet-4";
    const modelMap: Record<string, string> = {
      "claude-sonnet-4": "anthropic/claude-sonnet-4",
      "claude-opus-4-6": "anthropic/claude-opus-4",
      "gpt-4o": "openai/gpt-4o",
      "o3": "openai/o3",
      "deepseek-r1": "deepseek/deepseek-r1",
      "gemini-2.5-pro": "google/gemini-2.5-pro-preview",
    };
    return modelMap[model] || model;
  }

  /**
   * Resolve OpenAI model string (fallback provider).
   */
  private resolveOpenAIModel(): string {
    const model = this.state?.model || "claude-sonnet-4";
    const modelMap: Record<string, string> = {
      "claude-sonnet-4": "gpt-4o",
      "claude-opus-4-6": "gpt-4o",
      "gpt-4o": "gpt-4o",
      "o3": "o3",
      "deepseek-r1": "gpt-4o",
      "gemini-2.5-pro": "gpt-4o",
    };
    return modelMap[model] || "gpt-4o";
  }

  /**
   * Auto-start container on first message. Looks up node config from D1.
   */
  private async autoStartContainer(
    nodeId: string | undefined,
    sessionId: string | undefined,
    firstMessage: string,
    connection: Connection,
  ): Promise<void> {
    // Try to get node info from D1
    const nid = nodeId || this.state?.nodeId;
    const sid = sessionId || this.state?.sessionId;

    if (!nid) {
      connection.send(JSON.stringify({
        type: "error",
        message: "No nodeId provided. Include nodeId in your first message.",
      }));
      return;
    }

    try {
      // Broadcast that we're starting
      this.broadcast(JSON.stringify({
        type: "event",
        event: { type: "status", state: "thinking" },
        messageId: crypto.randomUUID(),
        timestamp: Date.now(),
      }));

      // Look up node + session from D1
      const nodeResult = await this.env.DB.prepare(
        `SELECT n.agent_type, n.model, n.config, s.git_repo_url, s.id as session_id
         FROM agent_node n JOIN agent_session s ON n.session_id = s.id
         WHERE n.id = ?`
      ).bind(nid).first<{
        agent_type: string;
        model: string;
        config: string;
        git_repo_url: string | null;
        session_id: string;
      }>();

      if (!nodeResult) {
        connection.send(JSON.stringify({
          type: "error",
          message: `Node ${nid} not found in database.`,
        }));
        return;
      }

      // Start the container
      await this.startContainer({
        agentType: nodeResult.agent_type,
        model: nodeResult.model,
        gitRepoUrl: nodeResult.git_repo_url ?? undefined,
        task: firstMessage,
        nodeId: nid,
        sessionId: nodeResult.session_id,
      });

      // Now send the first message to the container
      if (this.state?.containerId) {
        await this.sendToContainer(this.state.containerId, {
          type: "message",
          from: "user",
          content: firstMessage,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ChatAgent] Auto-start failed: ${msg}`);
      connection.send(JSON.stringify({
        type: "error",
        message: `Failed to start agent container: ${msg}`,
      }));
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
    apiKey?: string;
    envVars?: Record<string, string>;
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

    // Build env vars for the adapter process
    const adapterConfig: AdapterConfig = {
      agentType: config.agentType as AdapterConfig["agentType"],
      model: config.model,
      apiKey: config.apiKey || this.env.OPENROUTER_API_KEY || "",
      task: config.task,
      workspacePath: "/workspace",
      envVars: config.envVars,
    };
    const processEnv = buildAgentEnv(adapterConfig);

    // Resolve the adapter entrypoint command
    const adapterCmd = ADAPTER_COMMANDS[config.agentType];
    if (!adapterCmd) {
      throw new Error(`No adapter command for agent type: ${config.agentType}`);
    }

    // Start the adapter as a long-running background process
    const process = await sandbox.startProcess(adapterCmd, {
      cwd: "/workspace",
      env: processEnv,
    });

    console.log(
      `[ChatAgent] Process started: pid=${process.id} for node ${config.nodeId}`,
    );

    // Read stdout in the background and broadcast events
    this.readStdout(sandbox, process.id).catch((err) => {
      console.error(`[ChatAgent] stdout reader failed: ${err}`);
    });

    // Store state
    this.setState({
      nodeId: config.nodeId,
      sessionId: config.sessionId,
      agentType: config.agentType,
      model: config.model,
      containerId,
    });

    // Update D1 with container ID and status
    try {
      await this.env.DB.prepare(
        "UPDATE agent_node SET container_id = ?, status = 'running' WHERE id = ?",
      )
        .bind(containerId, config.nodeId)
        .run();
    } catch (err) {
      console.error("[ChatAgent] Failed to update node:", err);
    }

    return { containerId };
  }

  /**
   * Continuously read stdout from the container process and broadcast events.
   */
  private async readStdout(
    sandbox: ReturnType<typeof getSandbox>,
    processId: string,
  ): Promise<void> {
    // Poll process logs for new output
    let lastOffset = 0;
    const POLL_MS = 500;
    const MAX_IDLE = 300_000; // 5 min without output = stop polling
    let idleMs = 0;

    while (idleMs < MAX_IDLE) {
      try {
        const proc = await sandbox.getProcess(processId);
        if (!proc) break;

        const logs = await proc.getLogs();
        const newOutput = logs.stdout.slice(lastOffset);
        if (newOutput.length > 0) {
          idleMs = 0;
          for (const line of newOutput.split('\n')) {
            const trimmed = line.trim();
            if (trimmed) {
              await this.processStdoutLine(trimmed);
            }
          }
          lastOffset = logs.stdout.length;
        } else {
          idleMs += POLL_MS;
        }

        // Check if process exited
        if (proc.status === "completed" || proc.status === "killed") {
          console.log(`[ChatAgent] Process ${processId} ended: ${proc.status}`);
          break;
        }
      } catch (err) {
        console.error(`[ChatAgent] Log poll error: ${err}`);
        break;
      }

      await new Promise((r) => setTimeout(r, POLL_MS));
    }
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
