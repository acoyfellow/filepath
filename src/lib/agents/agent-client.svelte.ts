/**
 * Svelte 5-compatible agent client for ConversationAgent DO.
 * Wraps AgentClient from agents package for use in Svelte.
 */

import { AgentClient } from "agents/client";
import type { AgentEventType } from "$lib/protocol";
import type { AgentResult } from "$lib/types/workspace";

export interface ConversationAgentState {
  cancelRequested: boolean;
}

export interface AgentClientCallbacks {
  onFapEvent?: (event: AgentEventType) => void;
  onDone?: (result: AgentResult) => void;
  onError?: (error: string) => void;
  onStatus?: (status: "connecting" | "connected" | "closed") => void;
}

function parseBaseUrl(baseUrl: string): { host: string; protocol: "ws" | "wss" } {
  const u = new URL(baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`);
  const host = u.host;
  const protocol = u.protocol === "https:" ? "wss" : "ws";
  return { host, protocol };
}

export function createConversationAgentClient(
  agentId: string,
  baseUrl: string,
  callbacks: AgentClientCallbacks = {},
): AgentClient<ConversationAgentState> {
  const { host, protocol } = parseBaseUrl(baseUrl);

  const client = new AgentClient<ConversationAgentState>({
    agent: "ConversationAgent",
    name: agentId,
    host,
    protocol,
    onStateUpdate: (_state, _source) => {},
    onIdentity: () => callbacks.onStatus?.("connected"),
  });

  client.addEventListener("message", (event: MessageEvent) => {
    if (typeof event.data !== "string") return;
    try {
      const msg = JSON.parse(event.data) as { type?: string; event?: AgentEventType; result?: AgentResult; error?: string };
      if (msg.type === "fap" && msg.event) {
        callbacks.onFapEvent?.(msg.event);
      } else if (msg.type === "done" && msg.result) {
        callbacks.onDone?.(msg.result);
      } else if (msg.type === "error") {
        const errRaw = msg.error;
        const errMsg =
          typeof errRaw === "string" && errRaw.trim()
            ? errRaw.trim()
            : "Something went wrong while running this task.";
        callbacks.onError?.(errMsg);
      }
    } catch {
      // ignore parse errors
    }
  });

  client.addEventListener("open", () => callbacks.onStatus?.("connected"));
  client.addEventListener("close", () => callbacks.onStatus?.("closed"));

  return client;
}
