/**
 * Svelte 5 chat client for Cloudflare AIChatAgent.
 *
 * Uses AgentClient (vanilla WS) + the cf_agent chat protocol to
 * implement streaming chat with auto-persistent messages.
 *
 * This replaces the React useAgentChat hook with a runes-based approach.
 */
import { AgentClient } from 'agents/client';
import type { UIMessage } from 'ai';

/** Message types matching @cloudflare/ai-chat protocol */
const MSG = {
  CHAT_MESSAGES: 'cf_agent_chat_messages',
  CHAT_REQUEST: 'cf_agent_use_chat_request',
  CHAT_RESPONSE: 'cf_agent_use_chat_response',
  CHAT_CANCEL: 'cf_agent_chat_request_cancel',
  STREAM_RESUMING: 'cf_agent_stream_resuming',
  STREAM_RESUME_ACK: 'cf_agent_stream_resume_ack',
  CHAT_CLEAR: 'cf_agent_chat_clear',
} as const;

type ChatResponseMessage = {
  type: typeof MSG.CHAT_RESPONSE;
  id: string;
  body: string;
  done: boolean;
  error?: boolean;
  continuation?: boolean;
};

type ChatMessagesMessage = {
  type: typeof MSG.CHAT_MESSAGES;
  messages: UIMessage[];
};

type StreamResumingMessage = {
  type: typeof MSG.STREAM_RESUMING;
  id: string;
};

type ServerMessage = ChatResponseMessage | ChatMessagesMessage | StreamResumingMessage | { type: string };

export type ChatStatus = 'ready' | 'submitted' | 'streaming' | 'error';

interface AgentChatClientOptions {
  /** Worker base URL (e.g., https://api.myfilepath.com or http://localhost:8787) */
  workerUrl: string;
  /** Unique name for this chat agent instance (e.g., "chat-{slotId}") */
  agentName: string;
  /** Initial state to set on the agent (model, system prompt, etc.) */
  initialState?: Record<string, unknown>;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Creates a reactive Svelte 5 chat client connected to a ChatAgent DO.
 *
 * Returns an object with reactive state (messages, status, etc.)
 * and methods (sendMessage, cancel, clearHistory).
 */
export function createAgentChatClient(options: AgentChatClientOptions) {
  const { workerUrl, agentName, initialState } = options;

  // --- Reactive state (Svelte 5 runes) ---
  let messages = $state<UIMessage[]>([]);
  let status = $state<ChatStatus>('ready');
  let error = $state<Error | undefined>(undefined);
  let isConnected = $state(false);

  // Internal tracking
  let client: AgentClient | null = null;
  let activeStreamController: ReadableStreamDefaultController<Uint8Array> | null = null;
  let activeRequestId: string | null = null;
  let activeAbortController: AbortController | null = null;

  // --- WebSocket connection ---
  function connect() {
    // Parse the worker URL to get host for WS
    const url = new URL(workerUrl);

    client = new AgentClient({
      agent: 'chat-agent',
      name: agentName,
      host: url.host,
      protocol: url.protocol === 'https:' ? 'wss' : 'ws',
      onStateUpdate: () => {
        // Agent state updated (not chat messages)
      },
    });

    client.addEventListener('open', () => {
      isConnected = true;
      console.debug('[chat-client] connected to', agentName);

      // Set initial state if provided
      if (initialState && client) {
        client.setState(initialState as Record<string, unknown>);
      }
    });

    client.addEventListener('close', () => {
      isConnected = false;
      console.debug('[chat-client] disconnected');
    });

    client.addEventListener('error', () => {
      console.error('[chat-client] WebSocket error');
    });

    client.addEventListener('message', (event: MessageEvent) => {
      handleServerMessage(event);
    });
  }

  function handleServerMessage(event: MessageEvent) {
    let data: ServerMessage;
    try {
      data = JSON.parse(typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data)) as ServerMessage;
    } catch {
      return; // Not JSON, ignore (could be state sync etc.)
    }

    switch (data.type) {
      case MSG.CHAT_MESSAGES: {
        // Full message list sync from server
        const msgData = data as ChatMessagesMessage;
        messages = msgData.messages;
        break;
      }

      case MSG.CHAT_RESPONSE: {
        // Streaming SSE chunk from server
        const chunk = data as ChatResponseMessage;
        if (chunk.id !== activeRequestId) return;

        if (chunk.error) {
          error = new Error(chunk.body);
          status = 'error';
          closeActiveStream();
          return;
        }

        if (chunk.body?.trim() && activeStreamController) {
          // Enqueue as SSE format so the stream parser can process it
          const encoded = new TextEncoder().encode(`data: ${chunk.body}\n\n`);
          try {
            activeStreamController.enqueue(encoded);
          } catch {
            // Stream already closed
          }
        }

        if (chunk.done) {
          closeActiveStream();
          status = 'ready';
        } else if (status !== 'streaming') {
          status = 'streaming';
        }
        break;
      }

      case MSG.STREAM_RESUMING: {
        // Server has an active stream we can resume
        const resumeData = data as StreamResumingMessage;
        if (client) {
          client.send(JSON.stringify({
            type: MSG.STREAM_RESUME_ACK,
            id: resumeData.id,
          }));
        }
        break;
      }

      case MSG.CHAT_CLEAR: {
        messages = [];
        break;
      }
    }
  }

  function closeActiveStream() {
    if (activeStreamController) {
      try {
        activeStreamController.close();
      } catch {
        // Already closed
      }
      activeStreamController = null;
    }
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    activeRequestId = null;
  }

  // --- Public API ---

  /**
   * Send a text message to the agent.
   */
  function sendMessage(text: string) {
    if (!client || !isConnected) {
      console.warn('[chat-client] not connected, cannot send');
      return;
    }

    if (status === 'streaming' || status === 'submitted') {
      console.warn('[chat-client] already processing a message');
      return;
    }

    error = undefined;
    status = 'submitted';

    // Generate request ID
    const requestId = generateId();
    activeRequestId = requestId;
    activeAbortController = new AbortController();

    // Create the request body matching AI SDK's chat API format
    const userMessage: UIMessage = {
      id: generateId(),
      role: 'user',
      parts: [{ type: 'text', text }],
    };

    // Optimistically add user message to local state
    messages = [...messages, userMessage];

    // Build the request body (same format as DefaultChatTransport)
    const body = JSON.stringify({
      messages: messages,
    });

    // Send as CF_AGENT_USE_CHAT_REQUEST over WS
    client.send(JSON.stringify({
      type: MSG.CHAT_REQUEST,
      id: requestId,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      },
    }));

    // The response will come as CF_AGENT_USE_CHAT_RESPONSE messages
    // which we handle in handleServerMessage
    // We create a ReadableStream to collect chunks (useful if we want to
    // process the stream, but for now we just rely on the server-side
    // message persistence and the CHAT_MESSAGES sync)
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        activeStreamController = controller;
      },
      cancel() {
        // Stream cancelled (e.g., by abort)
        closeActiveStream();
      },
    });

    // Process the SSE stream in the background to parse assistant messages
    processStream(stream, requestId).catch((err) => {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('[chat-client] stream processing error:', err);
      }
    });
  }

  /**
   * Process the SSE stream from the agent to extract assistant message text.
   * This gives us real-time streaming updates before the server sends
   * the full CHAT_MESSAGES sync.
   */
  async function processStream(stream: ReadableStream<Uint8Array>, requestId: string) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let assistantText = '';
    let assistantMessageId = `assistant-${requestId}`;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);

          if (data === '[DONE]') continue;

          try {
            // AI SDK UI message stream format - each line is a JSON chunk
            // Format: type:value pairs like "2:text" or "0:text"
            // Actually the AI SDK stream format is more complex.
            // The toUIMessageStreamResponse sends UIMessageChunk SSE.
            // For now, let's parse the simple text deltas.
            //
            // The SSE body from the CF agent protocol is the raw SSE line content
            // (without the "data: " prefix). The content is already the SSE data field.
            // Let's just accumulate text parts.

            // AI SDK stream format: each chunk is like:
            //   0:"hello"     (text delta)
            //   2:[{...}]     (message parts)
            //   e:{...}       (error)
            //   d:{...}       (done)
            const colonIdx = data.indexOf(':');
            if (colonIdx === -1) continue;

            const typeChar = data.slice(0, colonIdx);
            const payload = data.slice(colonIdx + 1);

            if (typeChar === '0') {
              // Text delta
              try {
                const textDelta = JSON.parse(payload) as string;
                assistantText += textDelta;
                updateAssistantMessage(assistantMessageId, assistantText);
              } catch {
                // Not valid JSON text delta
              }
            }
            // Other chunk types (tool calls, etc.) will be handled
            // when we get the full CHAT_MESSAGES sync from the server
          } catch {
            // Ignore parse errors
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        throw err;
      }
    }
  }

  /**
   * Update or create the assistant message in the local messages array
   * for real-time streaming display.
   */
  function updateAssistantMessage(id: string, text: string) {
    const existingIdx = messages.findIndex(m => m.id === id);
    const assistantMessage: UIMessage = {
      id,
      role: 'assistant',
      parts: [{ type: 'text', text }],
    };

    if (existingIdx >= 0) {
      messages = [
        ...messages.slice(0, existingIdx),
        assistantMessage,
        ...messages.slice(existingIdx + 1),
      ];
    } else {
      messages = [...messages, assistantMessage];
    }
  }

  /**
   * Cancel the current streaming response.
   */
  function cancel() {
    if (!activeRequestId || !client) return;

    client.send(JSON.stringify({
      type: MSG.CHAT_CANCEL,
      id: activeRequestId,
    }));

    closeActiveStream();
    status = 'ready';
  }

  /**
   * Clear all messages.
   */
  function clearHistory() {
    if (!client) return;

    client.send(JSON.stringify({
      type: MSG.CHAT_CLEAR,
    }));

    messages = [];
  }

  /**
   * Push updated state to the ChatAgent DO (e.g., after containerId is assigned).
   */
  function updateState(state: Record<string, unknown>) {
    if (client && isConnected) {
      client.setState(state);
    }
  }

  /**
   * Wait for the WebSocket connection to be established.
   * Resolves `true` when connected, or `false` if the timeout expires.
   */
  function waitForConnection(timeoutMs: number = 10000): Promise<boolean> {
    if (isConnected) return Promise.resolve(true);

    return new Promise<boolean>((resolve) => {
      const pollIntervalMs = 50;
      let elapsed = 0;

      const interval = setInterval(() => {
        elapsed += pollIntervalMs;
        if (isConnected) {
          clearInterval(interval);
          resolve(true);
        } else if (elapsed >= timeoutMs) {
          clearInterval(interval);
          resolve(false);
        }
      }, pollIntervalMs);
    });
  }

  /**
   * Disconnect the WebSocket.
   */
  function disconnect() {
    closeActiveStream();
    if (client) {
      client.close();
      client = null;
    }
    isConnected = false;
  }

  // Auto-connect on creation
  connect();

  return {
    // Reactive state (getters so Svelte tracks them)
    get messages() { return messages; },
    get status() { return status; },
    get error() { return error; },
    get isConnected() { return isConnected; },
    get isStreaming() { return status === 'streaming'; },

    // Methods
    sendMessage,
    cancel,
    clearHistory,
    updateState,
    disconnect,
    reconnect: connect,
    waitForConnection,
  };
}

export type AgentChatClient = ReturnType<typeof createAgentChatClient>;
