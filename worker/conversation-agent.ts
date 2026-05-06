/**
 * ConversationAgent - Durable Object for filepath conversation execution.
 *
 * Each agent/conversation = one DO instance. Orchestrates sandbox task execution,
 * streams FAP events via broadcast, supports cancellation and A2A context search.
 */

import { Agent, callable } from "agents";
import type { AgentEventType } from "../src/lib/protocol";
import type { RuntimeEnv } from "../src/lib/runtime/agent-runtime";
import {
  acceptAgentTask,
  getAgentWorkspaceId,
  processAcceptedAgentTask,
} from "../src/lib/runtime/agent-runtime";

export interface ConversationAgentState {
  cancelRequested: boolean;
}

export interface ConversationAgentEnv extends RuntimeEnv {
  DB: RuntimeEnv["DB"];
  Sandbox?: RuntimeEnv["Sandbox"];
}

export class ConversationAgent extends Agent<ConversationAgentEnv, ConversationAgentState> {
  initialState: ConversationAgentState = {
    cancelRequested: false,
  };

  @callable()
  async runTask(content: string): Promise<{ taskId: string; ok: boolean }> {
    const agentId = this.name;
    const env = this.env as unknown as RuntimeEnv;
    if (!env.DB) {
      throw new Error("Database not available");
    }

    const workspaceId = await getAgentWorkspaceId(env, agentId);
    if (!workspaceId) {
      throw new Error(`Agent ${agentId} not found or has no workspace.`);
    }

    const requestId = crypto.randomUUID();
    const accepted = await acceptAgentTask(env, workspaceId, agentId, content, requestId);

    const onEvent = (e: AgentEventType) => {
      this.broadcast(
        JSON.stringify({ type: "fap", event: e }),
      );
    };

    const isCancelled = () => this.state.cancelRequested;

    void processAcceptedAgentTask(
      env,
      workspaceId,
      agentId,
      accepted.taskId,
      content,
      requestId,
      { onEvent, isCancelled },
    ).then(({ result }) => {
      this.setState({ ...this.state, cancelRequested: false });
      this.broadcast(JSON.stringify({ type: "done", result }));
    }).catch((err) => {
      this.setState({ ...this.state, cancelRequested: false });
      const raw = err instanceof Error ? err.message : String(err);
      const message = raw.trim() || "Something went wrong while running this task.";
      this.broadcast(JSON.stringify({ type: "error", error: message }));
    });

    return { taskId: accepted.taskId, ok: true };
  }

  @callable()
  cancelTask(): void {
    this.setState({ ...this.state, cancelRequested: true });
  }
}
