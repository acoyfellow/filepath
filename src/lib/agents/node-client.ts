/**
 * Thin browser client for ChatAgent DO.
 *
 * Uses the Cloudflare Agents SDK client for transport/reconnect behavior,
 * while keeping filepath's existing custom chat payloads on top:
 *
 *   Client → DO: { type: "message", content: "..." }
 *   DO → Client: { type: "event", event: AgentEvent, messageId, timestamp }
 *                 { type: "error", message: "..." }
 *                 { type: "tree_update", action, node }
 */

import { AgentClient } from "agents/client";
import type { AgentEventType } from '$lib/protocol';

/** A persisted message from DO SQLite */
export interface HistoryMessage {
  id: string;
  role: string;
  content: string;
  createdAt: number;
}

/** Message from the DO broadcast */
export interface DOMessage {
  type: 'event' | 'error' | 'tree_update' | 'history';
  event?: AgentEventType;
  role?: string;
  message?: string;
  messageId?: string;
  timestamp?: number;
  action?: string;
  node?: Record<string, unknown>;
  messages?: HistoryMessage[];
}

export type ConnectionState = 'connecting' | 'open' | 'closed' | 'error';

export interface NodeClientCallbacks {
  onMessage: (msg: DOMessage) => void;
  onStateChange: (state: ConnectionState) => void;
  authToken?: string | null;
}

interface ProtocolMessage {
  type?: string;
}

const INTERNAL_PROTOCOL_TYPES = new Set([
  "cf_agent_identity",
  "cf_agent_state",
  "cf_agent_state_error",
  "rpc",
]);

/**
 * Create a WebSocket connection to a ChatAgent DO instance.
 * Returns control handles for send/close.
 */
export function createNodeClient(
  workerUrl: string,
  sessionId: string,
  nodeId: string,
  callbacks: NodeClientCallbacks,
): {
  send: (content: string) => void;
  close: () => void;
  getState: () => ConnectionState;
} {
  let ws: AgentClient | null = null;
  let state: ConnectionState = 'connecting';
  const MAX_RECONNECT = 5;
  const BASE_DELAY = 1000;

  function setState(s: ConnectionState) {
    state = s;
    callbacks.onStateChange(s);
  }

  function parseCustomMessage(data: string): DOMessage | null {
    try {
      const parsed = JSON.parse(data) as DOMessage & ProtocolMessage;
      if (parsed.type && INTERNAL_PROTOCOL_TYPES.has(parsed.type)) {
        return null;
      }
      return parsed;
    } catch {
      console.warn('[NodeClient] Unparseable message:', data);
      return null;
    }
  }

  function connect() {
    const base = new URL(workerUrl);
    setState('connecting');

    ws = new AgentClient({
      agent: 'chat-agent',
      name: sessionId,
      host: base.host,
      protocol: base.protocol === "https:" ? "wss" : "ws",
      query: callbacks.authToken ? { token: callbacks.authToken } : undefined,
      minReconnectionDelay: BASE_DELAY,
      maxReconnectionDelay: BASE_DELAY * 8,
      reconnectionDelayGrowFactor: 2,
      maxRetries: MAX_RECONNECT,
    });

    ws.addEventListener('open', () => {
      ws?.send(JSON.stringify({ type: "init", nodeId, sessionId }));
      setState('open');
    });

    ws.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') {
        return;
      }

      const data = parseCustomMessage(event.data);
      if (data) {
        callbacks.onMessage(data);
      }
    });

    ws.addEventListener('close', (event) => {
      if (!ws) {
        setState('closed');
        return;
      }

      if (event.code >= 4000 && event.code < 5000) {
        ws.close(event.code, event.reason);
        setState('closed');
        return;
      }

      setState(ws.shouldReconnect ? 'connecting' : 'closed');
    });

    ws.addEventListener('error', () => {
      setState('error');
    });
  }

  connect();

  return {
    send(content: string) {
      if (ws?.readyState === AgentClient.OPEN) {
        ws.send(JSON.stringify({ type: 'message', content, nodeId }));
      }
    },
    close() {
      ws?.close();
      ws = null;
      setState('closed');
    },
    getState() {
      return state;
    },
  };
}
