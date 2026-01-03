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

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    return new Response('Not found', { status: 404 });
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    console.log('[TabBroadcastDO] handleWebSocket called:', { url: request.url });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    try {
      console.log('[TabBroadcastDO] Accepting WebSocket connection');
      server.accept();
      this.clients.add(server);
      console.log('[TabBroadcastDO] WebSocket accepted, clients:', this.clients.size);

      // Extract sandboxId from request URL (format: /terminal/:sessionId/:tabId/ws)
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/');
      // Path format: /terminal/:sessionId/:tabId/ws
      const sessionId = pathParts[2];
      const tabId = pathParts[3];
      const sandboxId = `${sessionId}:${tabId}`;
      console.log('[TabBroadcastDO] Extracted:', { sessionId, tabId, sandboxId, pathname: url.pathname });

      // Restore scrollback to new client before connecting to ttyd
      await this.sendScrollbackToClient(server, sandboxId);

      // Connect to ttyd if not already connected
      if (!this.ttyd || this.ttyd.readyState !== WebSocket.OPEN) {
        console.log('[TabBroadcastDO] Connecting to ttyd for:', sandboxId);
        await this.connectTtyd(request, sandboxId);
        console.log('[TabBroadcastDO] ttyd connection state:', this.ttyd?.readyState);
      } else {
        console.log('[TabBroadcastDO] ttyd already connected');
      }

      // Forward messages from client to ttyd
      server.addEventListener('message', (event) => {
        if (this.ttyd && this.ttyd.readyState === WebSocket.OPEN) {
          try {
            this.ttyd.send(event.data);
          } catch (err) {
            console.error('Error forwarding client message to ttyd:', err);
          }
        }
      });

      // Clean up on client disconnect
      server.addEventListener('close', () => {
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

      console.log('[TabBroadcastDO] Returning WebSocket response (101)');
      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    } catch (error) {
      console.error('[TabBroadcastDO] WebSocket handler error:', error, {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      // Still return WebSocket - connection established
      try {
        server.accept();
        this.clients.add(server);
        server.addEventListener('close', () => {
          this.clients.delete(server);
        });
      } catch (fallbackError) {
        console.error('Failed to establish fallback WebSocket:', fallbackError);
        this.clients.delete(server);
      }

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }
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

      // Broadcast ttyd messages to all clients and capture scrollback
      this.ttyd.addEventListener('message', async (event) => {
        // Broadcast to all clients
        for (const client of this.clients) {
          if (client.readyState === WebSocket.OPEN) {
            try {
              client.send(event.data);
            } catch (err) {
              // Remove dead connections
              this.clients.delete(client);
            }
          }
        }

        // Capture scrollback
        if (event.data instanceof ArrayBuffer) {
          const u8 = new Uint8Array(event.data);
          if (u8.length > 0) {
            const cmd = String.fromCharCode(u8[0]);
            if (cmd === '0') {  // CMD_OUTPUT
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
    try {
      const stored = await this.ctx.storage.get<TabScrollback>('scrollback');
      if (stored?.chunks && stored.chunks.length > 0) {
        const textEncoder = new TextEncoder();
        for (const chunk of stored.chunks) {
          const payload = new Uint8Array(chunk.length + 1);
          payload[0] = '0'.charCodeAt(0);  // CMD_OUTPUT
          const encoded = textEncoder.encode(chunk);
          payload.set(encoded, 1);
          client.send(payload);
        }
      }
    } catch (err) {
      console.error('Failed to send scrollback:', err);
    }
  }
}

