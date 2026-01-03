import { DurableObject } from 'cloudflare:workers';
import { getSandbox, Sandbox as SandboxDO } from '@cloudflare/sandbox';

interface TabScrollback {
  chunks: string[];  // Terminal output chunks
  lastUpdated: number;
}

// TabBroadcast Durable Object - manages WebSocket connections per tab and broadcasts ttyd output
// Enables cross-browser sync for terminal tabs
export class TabBroadcastDO extends DurableObject {
  private clients: Set<WebSocket> = new Set();
  private ttyd: WebSocket | null = null;
  private messageQueue: ArrayBuffer[] = []; // Queue messages until ttyd is ready

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    return new Response('Not found', { status: 404 });
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    console.log('[TabBroadcastDO] handleWebSocket called:', { url: request.url });

    let client: WebSocket;
    let server: WebSocket;

    try {
      const pair = new WebSocketPair();
      [client, server] = Object.values(pair);
    } catch (error) {
      console.error('[TabBroadcastDO] Failed to create WebSocketPair:', error);
      return new Response('Failed to create WebSocket', { status: 500 });
    }

    // Extract sandboxId from request URL (format: /terminal/:sessionId/:tabId/ws)
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    // Path format: /terminal/:sessionId/:tabId/ws
    const sessionId = pathParts[2];
    const tabId = pathParts[3];
    const sandboxId = `${sessionId}:${tabId}`;
    console.log('[TabBroadcastDO] Extracted:', { sessionId, tabId, sandboxId, pathname: url.pathname });

    // Accept WebSocket using Durable Object hibernation API
    try {
      console.log('[TabBroadcastDO] Accepting WebSocket connection with hibernation API');
      this.ctx.acceptWebSocket(server);
      this.clients.add(server);
      console.log('[TabBroadcastDO] WebSocket accepted, clients:', this.clients.size);
    } catch (error) {
      console.error('[TabBroadcastDO] Failed to accept WebSocket:', error);
      return new Response('Failed to accept WebSocket', { status: 500 });
    }

    // Set up message forwarding and cleanup handlers
    // ttyd uses the same protocol: INPUT='0', OUTPUT='0', RESIZE='1'
    // Queue messages if ttyd isn't ready yet (e.g., initial terminal size message)
    server.addEventListener('message', (event) => {
      if (this.ttyd && this.ttyd.readyState === WebSocket.OPEN) {
        try {
          this.ttyd.send(event.data);
        } catch (err) {
          console.error('[TabBroadcastDO] Error forwarding client message to ttyd:', err);
        }
      } else {
        // Queue message until ttyd is ready
        console.log('[TabBroadcastDO] Queueing message - ttyd not ready yet');
        if (event.data instanceof ArrayBuffer) {
          this.messageQueue.push(event.data);
        }
      }
    });

    server.addEventListener('close', () => {
      console.log('[TabBroadcastDO] Client WebSocket closed');
      this.clients.delete(server);
      // If no clients left, close ttyd connection
      if (this.clients.size === 0 && this.ttyd) {
        try {
          this.ttyd.close();
        } catch (err) {
          // Ignore errors on close
        }
        this.ttyd = null;
      }
    });

    // Connect to ttyd BEFORE returning 101 - like ironalarm example
    // This ensures ttyd is ready to send data immediately
    try {
      if (!this.ttyd || this.ttyd.readyState !== WebSocket.OPEN) {
        console.log('[TabBroadcastDO] Connecting to ttyd synchronously before returning 101');
        await this.connectTtyd(request, sandboxId);
        console.log('[TabBroadcastDO] ttyd connected, readyState:', this.ttyd?.readyState);
      } else {
        console.log('[TabBroadcastDO] ttyd already connected');
        // Flush any queued messages
        if (this.messageQueue.length > 0) {
          console.log(`[TabBroadcastDO] Flushing ${this.messageQueue.length} queued messages`);
          for (const msg of this.messageQueue) {
            try {
              this.ttyd.send(msg);
            } catch (err) {
              console.error('[TabBroadcastDO] Error sending queued message:', err);
            }
          }
          this.messageQueue = [];
        }
      }

      // Send scrollback immediately (like ironalarm sends initial state)
      await this.sendScrollbackToClient(server, sandboxId);
    } catch (error) {
      console.error('[TabBroadcastDO] Error connecting to ttyd before 101:', error);
      // Still return 101 - connection is established, ttyd can connect later
    }

    // Return WebSocket response AFTER ttyd is connected (like ironalarm pattern)
    console.log('[TabBroadcastDO] Returning WebSocket response (101)');
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private async connectTtyd(request: Request, sandboxId: string): Promise<void> {
    console.log('[TabBroadcastDO] connectTtyd called:', { sandboxId, url: request.url });
    try {
      // Get sandbox for this tab
      const sandbox = getSandbox((this.env as any).Sandbox, sandboxId);

      // Rewrite URL to /ws for ttyd
      const originalUrl = new URL(request.url);
      const ttydUrl = new URL('/ws' + originalUrl.search, originalUrl.origin);
      const wsRequest = new Request(ttydUrl.toString(), {
        method: request.method,
        headers: request.headers,
      });

      console.log('[TabBroadcastDO] Connecting to ttyd:', { sandboxId, ttydUrl: ttydUrl.toString() });

      let ttydResponse;
      try {
        console.log('[TabBroadcastDO] Calling sandbox.wsConnect:', { sandboxId, port: 7681 });
        ttydResponse = await sandbox.wsConnect(wsRequest, 7681);
        console.log('[TabBroadcastDO] ttyd wsConnect response:', {
          status: ttydResponse.status,
          statusText: ttydResponse.statusText,
          headers: Object.fromEntries(ttydResponse.headers.entries())
        });
      } catch (connectError) {
        console.error('[TabBroadcastDO] ttyd wsConnect failed:', {
          error: connectError,
          message: connectError instanceof Error ? connectError.message : String(connectError),
          stack: connectError instanceof Error ? connectError.stack : undefined,
          sandboxId
        });
        // Container might be sleeping, try to wake by starting ttyd
        console.log('[TabBroadcastDO] Container may be sleeping, attempting wake:', sandboxId);
        try {
          const ttyd = await sandbox.startProcess('ttyd -W -p 7681 bash');
          await ttyd.waitForPort(7681, { mode: 'tcp', timeout: 60000 });
          // Wait a bit for ttyd to be ready
          await new Promise(resolve => setTimeout(resolve, 1000));
          // Retry connection
          ttydResponse = await sandbox.wsConnect(wsRequest, 7681);
        } catch (wakeError) {
          console.error('[TabBroadcastDO] Wake failed:', {
            error: wakeError,
            message: wakeError instanceof Error ? wakeError.message : String(wakeError),
            stack: wakeError instanceof Error ? wakeError.stack : undefined,
            sandboxId
          });
          throw connectError; // Throw original error
        }
      }

      console.log('[TabBroadcastDO] ttyd response check:', {
        status: ttydResponse?.status,
        hasWebSocket: !!ttydResponse?.webSocket,
        sandboxId
      });

      if (ttydResponse.status !== 101 || !ttydResponse.webSocket) {
        console.error('[TabBroadcastDO] Invalid ttyd response:', {
          status: ttydResponse.status,
          hasWebSocket: !!ttydResponse.webSocket,
          sandboxId
        });
        throw new Error(`Failed to connect to ttyd: status ${ttydResponse.status}`);
      }

      console.log('[TabBroadcastDO] Accepting ttyd WebSocket');

      this.ttyd = ttydResponse.webSocket;
      this.ttyd.accept();
      console.log('[TabBroadcastDO] ttyd WebSocket accepted, readyState:', this.ttyd.readyState);

      // Flush queued messages to ttyd (e.g., initial terminal size)
      if (this.messageQueue.length > 0) {
        console.log(`[TabBroadcastDO] Flushing ${this.messageQueue.length} queued messages to ttyd`);
        for (const msg of this.messageQueue) {
          try {
            this.ttyd.send(msg);
          } catch (err) {
            console.error('[TabBroadcastDO] Error sending queued message to ttyd:', err);
          }
        }
        this.messageQueue = [];
      }

      // Broadcast ttyd messages to all clients and capture scrollback
      // ttyd sends OUTPUT='0' prefix, which matches client's CMD_OUTPUT='0'
      this.ttyd.addEventListener('message', async (event) => {
        // Broadcast to all clients
        for (const client of this.clients) {
          if (client.readyState === WebSocket.OPEN) {
            try {
              client.send(event.data);
            } catch (err) {
              console.error('[TabBroadcastDO] Error broadcasting to client:', err);
              // Remove dead connections
              this.clients.delete(client);
            }
          } else {
            this.clients.delete(client);
          }
        }

        // Capture scrollback (ttyd sends OUTPUT='0' prefix)
        if (event.data instanceof ArrayBuffer) {
          const u8 = new Uint8Array(event.data);
          if (u8.length > 0) {
            const cmd = String.fromCharCode(u8[0]);
            if (cmd === '0') {  // OUTPUT/CMD_OUTPUT
              const output = new TextDecoder().decode(u8.slice(1));
              await this.appendScrollback(sandboxId, output);
            }
          }
        }
      });

      // Handle ttyd disconnect
      this.ttyd.addEventListener('close', () => {
        console.log('TabBroadcast: ttyd disconnected for sandbox:', sandboxId);
        // Close all client connections
        for (const client of this.clients) {
          if (client.readyState === WebSocket.OPEN) {
            try {
              client.close(1000, 'ttyd disconnected');
            } catch (err) {
              // Ignore errors
            }
          }
        }
        this.clients.clear();
        this.ttyd = null;
      });

      // Handle ttyd errors
      this.ttyd.addEventListener('error', (error) => {
        console.error('TabBroadcast: ttyd error for sandbox:', sandboxId, error);
      });

      console.log('TabBroadcast: ttyd connected for sandbox:', sandboxId);
    } catch (error) {
      console.error('TabBroadcast: Failed to connect to ttyd:', error);
      throw error;
    }
  }

  private async appendScrollback(sandboxId: string, output: string): Promise<void> {
    try {
      const stored = await this.ctx.storage.get<TabScrollback>('scrollback');
      const chunks = (stored?.chunks || []).concat([output]);
      // Limit to last 1000 chunks
      const limited = chunks.slice(-1000);
      await this.ctx.storage.put('scrollback', {
        chunks: limited,
        lastUpdated: Date.now(),
      });
    } catch (err) {
      console.error('Failed to append scrollback:', err);
    }
  }

  private async sendScrollbackToClient(client: WebSocket, sandboxId: string): Promise<void> {
    console.log('[TabBroadcastDO] Attempting to send scrollback to client.');
    if (client.readyState !== WebSocket.OPEN) {
      console.warn('[TabBroadcastDO] Client WebSocket not open, cannot send scrollback.');
      return;
    }
    try {
      const stored = await this.ctx.storage.get<TabScrollback>('scrollback');
      if (stored?.chunks && stored.chunks.length > 0) {
        console.log(`[TabBroadcastDO] Sending ${stored.chunks.length} scrollback chunks to client.`);
        const textEncoder = new TextEncoder();
        for (const chunk of stored.chunks) {
          if (client.readyState !== WebSocket.OPEN) {
            console.warn('[TabBroadcastDO] Client closed during scrollback send, stopping.');
            break;
          }
          const payload = new Uint8Array(chunk.length + 1);
          payload[0] = '0'.charCodeAt(0);  // CMD_OUTPUT
          const encoded = textEncoder.encode(chunk);
          payload.set(encoded, 1);
          client.send(payload);
        }
        console.log('[TabBroadcastDO] Scrollback sent successfully.');
      } else {
        console.log('[TabBroadcastDO] No scrollback to send.');
      }
    } catch (err) {
      console.error('[TabBroadcastDO] Failed to send scrollback:', err);
    }
  }
}

