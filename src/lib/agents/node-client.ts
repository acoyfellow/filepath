/**
 * Thin WebSocket client for ChatAgent DO.
 *
 * Speaks the DO's native protocol:
 *   Client → DO: { type: "message", content: "..." }
 *   DO → Client: { type: "event", event: AgentEvent, messageId, timestamp }
 *                 { type: "error", message: "..." }
 *                 { type: "tree_update", action, node }
 */

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

/**
 * Create a WebSocket connection to a ChatAgent DO instance.
 * Returns control handles for send/close.
 */
export function createNodeClient(
  workerUrl: string,
  nodeId: string,
  callbacks: NodeClientCallbacks,
): {
  send: (content: string) => void;
  close: () => void;
  getState: () => ConnectionState;
} {
  let ws: WebSocket | null = null;
  let state: ConnectionState = 'connecting';
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT = 5;
  const BASE_DELAY = 1000;

  function setState(s: ConnectionState) {
    state = s;
    callbacks.onStateChange(s);
  }

  function connect() {
    const base = new URL(workerUrl);
    base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
    const url = new URL(`/agents/chat-agent/${nodeId}`, base);
    if (callbacks.authToken) {
      url.searchParams.set('token', callbacks.authToken);
    }

    setState('connecting');
    ws = new WebSocket(url.toString());

    ws.onopen = () => {
      reconnectAttempts = 0;
      setState('open');
    };

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string) as DOMessage;
        callbacks.onMessage(data);
      } catch {
        console.warn('[NodeClient] Unparseable message:', ev.data);
      }
    };

    ws.onclose = (ev) => {
      setState('closed');
      // Auto-reconnect on abnormal close
      if (!ev.wasClean && reconnectAttempts < MAX_RECONNECT) {
        const delay = BASE_DELAY * Math.pow(2, reconnectAttempts);
        reconnectAttempts++;
        reconnectTimer = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      setState('error');
    };
  }

  connect();

  return {
    send(content: string, opts?: { nodeId?: string; sessionId?: string }) {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'message', content, nodeId, ...opts }));
      }
    },
    close() {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectAttempts = MAX_RECONNECT; // prevent reconnect
      ws?.close();
    },
    getState() {
      return state;
    },
  };
}
