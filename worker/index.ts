import { Hono } from 'hono';
import { getSandbox, Sandbox } from '@cloudflare/sandbox';

// Export Sandbox class for Wrangler
export { Sandbox };

type Env = {
  Sandbox?: DurableObjectNamespace<Sandbox>;
  CONTAINER_URL?: string;
};

const app = new Hono<{ Bindings: Env }>();

// Helper to get sandbox response (local dev fallback or production binding)
async function getSandboxResponse(c: any, path: string = '/', sessionId: string = 'test') {
  const sandboxBinding = c.env.Sandbox;

  // Local dev: use HTTP fallback when no Sandbox binding
  if (!sandboxBinding) {
    const containerUrl = c.env.CONTAINER_URL || 'http://localhost:8081';
    return fetch(`${containerUrl}${path}`);
  }

  // Production: use Sandbox binding
  const sandbox = getSandbox(sandboxBinding, sessionId);

  // Test HTTP fetch to sandbox
  const testRequest = new Request('http://example/', {
    method: 'GET',
    headers: c.req.header(),
  });
  return sandbox.fetch(testRequest);
}

// Test endpoint to verify sandbox connectivity
app.get('/', async (c) => {
  try {
    const response = await getSandboxResponse(c);
    const text = await response.text();

    return c.json({
      status: response.status,
      statusText: response.statusText,
      body: text,
    });
  } catch (error) {
    console.error('[Test] Sandbox connection error:', error);
    return c.json({
      error: String(error),
      message: 'Sandbox connection failed',
      stack: error instanceof Error ? error.stack : undefined,
    }, 500);
  }
});

// Terminal start endpoint - starts ttyd process in sandbox
app.post('/terminal/:sessionId/start', async (c) => {
  const sessionId = c.req.param('sessionId');

  if (!sessionId) {
    return c.json({ error: 'sessionId required' }, 400);
  }

  const sandboxBinding = c.env.Sandbox;

  // Local dev: return success (container server handles ttyd)
  if (!sandboxBinding) {
    return c.json({ success: true, sessionId, message: 'Local dev mode - container server handles ttyd' });
  }

  try {
    const sandbox = getSandbox(sandboxBinding as any, sessionId);

    // Start ttyd process
    console.log(`[Worker] Starting ttyd for session: ${sessionId}`);
    const ttyd = await sandbox.startProcess('ttyd -W -p 7681 bash');

    // Wait for port 7681 to be ready
    console.log(`[Worker] Waiting for port 7681...`);
    await ttyd.waitForPort(7681, { mode: 'tcp', timeout: 30000 });

    console.log(`[Worker] ttyd ready on port 7681 for session: ${sessionId}`);

    return c.json({ success: true, sessionId });
  } catch (error) {
    console.error(`[Worker] Failed to start ttyd for session ${sessionId}:`, error);
    return c.json({
      error: String(error),
      message: 'Failed to start terminal',
      stack: error instanceof Error ? error.stack : undefined,
    }, 500);
  }
});

// WebSocket terminal connection endpoint
app.get('/terminal/:sessionId/ws', async (c) => {
  const upgrade = c.req.header('Upgrade');
  if (upgrade?.toLowerCase() !== 'websocket') {
    return c.text('Expected WebSocket upgrade', 400);
  }

  const sessionId = c.req.param('sessionId');
  if (!sessionId) {
    return c.text('sessionId required', 400);
  }

  const sandboxBinding = c.env.Sandbox;

  // Local dev: proxy to container server WebSocket
  if (!sandboxBinding) {
    const containerUrl = c.env.CONTAINER_URL || 'http://localhost:8081';
    const wsUrl = containerUrl.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws';

    // For local dev, we'll need to handle this differently
    // Return error for now - container server will handle WebSocket directly
    return c.text('WebSocket not available in local dev mode - use container server directly', 501);
  }

  // Production: use Sandbox WebSocket
  try {
    const sandbox = getSandbox(sandboxBinding as any, sessionId);

    // Create WebSocketPair for client connection
    const pair = new WebSocketPair() as { 0: WebSocket; 1: WebSocket & { accept(): void } };
    const client = pair[0];
    const server = pair[1];
    (server as any).accept();

    // Connect to ttyd asynchronously
    (async () => {
      try {
        console.log(`[Worker] Connecting to ttyd for session: ${sessionId}`);

        // Rewrite URL to /ws for ttyd
        const originalUrl = new URL(c.req.url);
        const ttydUrl = new URL('/ws', originalUrl.origin);
        const wsRequest = new Request(ttydUrl.toString(), {
          method: c.req.raw.method,
          headers: c.req.raw.headers,
        });

        console.log(`[Worker] Calling sandbox.wsConnect to port 7681...`);
        const ttydResponse = await sandbox.wsConnect(wsRequest, 7681) as Response & { webSocket?: WebSocket };

        if (ttydResponse.status !== 101 || !ttydResponse.webSocket) {
          console.error(`[Worker] ttyd connection failed:`, ttydResponse.status);
          server.close(1011, 'Failed to connect to ttyd');
          return;
        }

        const ttydWs = ttydResponse.webSocket;
        console.log(`[Worker] ttyd WebSocket received, accepting...`);
        (ttydWs as any).accept();

        // Attach listeners BEFORE sending size message
        ttydWs.addEventListener('message', (event) => {
          console.log(`[Worker] Received from ttyd:`, {
            type: typeof event.data,
            length: event.data instanceof ArrayBuffer ? event.data.byteLength : event.data?.length,
          });
          if (server.readyState === WebSocket.OPEN) {
            server.send(event.data);
          }
        });

        server.addEventListener('message', (event: MessageEvent) => {
          console.log(`[Worker] Received from client:`, {
            type: typeof event.data,
            length: event.data instanceof ArrayBuffer ? event.data.byteLength : event.data?.length,
          });
          if (ttydWs.readyState === WebSocket.OPEN) {
            ttydWs.send(event.data);
          }
        });

        server.addEventListener('close', () => {
          console.log(`[Worker] Client WebSocket closed`);
          if (ttydWs.readyState === WebSocket.OPEN) {
            ttydWs.close();
          }
        });

        ttydWs.addEventListener('close', () => {
          console.log(`[Worker] ttyd WebSocket closed`);
          if (server.readyState === WebSocket.OPEN) {
            server.close();
          }
        });

        // Small delay to ensure listeners are attached and ttyd is ready
        await new Promise(resolve => setTimeout(resolve, 100));

        // ttyd protocol: Send terminal size as JSON immediately after connection
        // Format: {"columns": number, "rows": number}
        // This triggers ttyd to send the initial bash prompt
        // ttyd expects this as a TEXT message (JSON string), not binary
        const sizeMsg = JSON.stringify({ columns: 80, rows: 24 });
        console.log(`[Worker] Sending terminal size to ttyd (text):`, sizeMsg);
        ttydWs.send(sizeMsg);
      } catch (error) {
        console.error(`[Worker] WebSocket connection error:`, error);
        server.close(1011, String(error));
      }
    })();

    return new Response(null, {
      status: 101,
      webSocket: client,
    } as ResponseInit & { webSocket: WebSocket });
  } catch (error) {
    console.error(`[Worker] Failed to create WebSocket connection:`, error);
    return c.json({
      error: String(error),
      message: 'Failed to create WebSocket connection',
    }, 500);
  }
});

export default {
  fetch: app.fetch.bind(app),
};
