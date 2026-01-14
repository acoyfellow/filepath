import { Hono } from 'hono';
import { html } from 'hono/html';
import { getSandbox, Sandbox } from '@cloudflare/sandbox';
import { Effect } from 'effect';
import { ContainerError, WebSocketError, retryWithBackoff, withTimeout } from './effects';
import { Session, Tab } from './types';

// Export Sandbox class for Wrangler
export { Sandbox };

type Env = {
  Sandbox?: DurableObjectNamespace<Sandbox>;
  CONTAINER_URL?: string;
  LOCAL_DEV?: string;
};

const sessions = new Map<string, Session>();

const app = new Hono<{ Bindings: Env }>();

// Session management routes
app.post('/session', async (c) => {
  const sessionId = crypto.randomUUID();
  const session: Session = {
    id: sessionId,
    tabs: [{ id: 'tab1', name: 'Terminal 1' }],
    activeTab: 0
  };
  sessions.set(sessionId, session);
  return c.json({ sessionId });
});

app.get('/session/:sessionId/info', async (c) => {
  const sessionId = c.req.param('sessionId');
  const session = sessions.get(sessionId);
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }
  return c.json({
    sessionId: session.id,
    hasPassword: !!session.password
  });
});

app.get('/session/:sessionId/tabs', async (c) => {
  const sessionId = c.req.param('sessionId');
  const session = sessions.get(sessionId);
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }
  return c.json({
    tabs: session.tabs,
    activeTab: session.activeTab
  });
});

app.post('/session/:sessionId/tabs', async (c) => {
  const sessionId = c.req.param('sessionId');
  const session = sessions.get(sessionId);
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }
  const body = await c.req.json();
  if (body.tabs) {
    session.tabs = body.tabs;
  }
  if (typeof body.activeTab === 'number') {
    session.activeTab = body.activeTab;
  }
  return c.json({ success: true });
});

// Check if we're in local dev mode (no containers configured)
function isLocalDev(c: any): boolean {
  // Always use local dev if LOCAL_DEV env var is set
  if (c.env?.LOCAL_DEV === 'true') return true;
  if (!c.env?.Sandbox) return true;
  // Try to create and use a sandbox stub
  try {
    const sandbox = getSandbox(c.env.Sandbox, 'test');
    // Try a simple operation to verify containers are enabled
    // In wrangler dev without containers, this will throw synchronously
    // because the DO constructor is called eagerly
    void sandbox.fetch; // Access fetch to trigger any lazy initialization
    return false; // Production mode - stub works
  } catch (error) {
    console.log('[Debug] Sandbox access failed, using local dev mode:', String(error));
    return true; // Local dev mode
  }
}

// Helper to get sandbox response (local dev fallback or production binding)
async function getSandboxResponse(c: any, path: string = '/', sessionId: string = 'test') {
  // If LOCAL_DEV is set or no Sandbox binding, use local dev
  if (c.env.LOCAL_DEV === 'true' || !c.env.Sandbox) {
    const containerUrl = c.env?.CONTAINER_URL || 'http://localhost:8085';
    return fetch(`${containerUrl}${path}`);
  }

  // Try Sandbox binding first, fall back to local dev on error
  try {
    const sandbox = getSandbox(c.env.Sandbox, sessionId);

    // Test HTTP fetch to sandbox
    const testRequest = new Request('http://example/', {
      method: 'GET',
      headers: c.req.header(),
    });
    const response = await sandbox.fetch(testRequest);
    return response;
  } catch (error) {
    // Any error from sandbox, fall back to local dev
    const errorMsg = String(error);
    console.log('[Worker] Sandbox failed, falling back to local dev:', errorMsg.substring(0, 100));
    const containerUrl = c.env?.CONTAINER_URL || 'http://localhost:8085';
    return fetch(`${containerUrl}${path}`);
  }
}

// Test endpoint to verify sandbox connectivity
app.get('/test/container', async (c) => {
  try {
    const response = await getSandboxResponse(c, '/', 'test');
    const text = await response.text();

    return c.json({
      status: response.status,
      statusText: response.statusText,
      body: text,
    });
  } catch (error) {
    const errorMsg = String(error);
    // If containers aren't enabled, fall back to local dev
    if (errorMsg.includes('Containers have not been enabled')) {
      console.log('[Test] Containers not enabled, using local dev fallback');
      try {
    const containerUrl = c.env?.CONTAINER_URL || 'http://localhost:8085';
        const response = await fetch(`${containerUrl}/`);
        const text = await response.text();
        return c.json({
          status: response.status,
          statusText: response.statusText,
          body: text,
          mode: 'local-dev-fallback',
        });
      } catch (fallbackError) {
        console.error('[Test] Local dev fallback also failed:', fallbackError);
        return c.json({
          error: String(fallbackError),
          message: 'Both sandbox and local dev failed',
        }, 500);
      }
    }
    console.error('[Test] Sandbox connection error:', error);
    return c.json({
      error: errorMsg,
      message: 'Sandbox connection failed',
      stack: error instanceof Error ? error.stack : undefined,
    }, 500);
  }
});

// Session page - serves HTML with tab bar + iframe
app.get('/session/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');
  const session = sessions.get(sessionId);
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  const protocol = c.req.url.startsWith('https://') ? 'wss:' : 'ws:';
  const host = new URL(c.req.url).host;

  return c.html(html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Session ${sessionId}</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-900 h-screen overflow-hidden">
        <!-- Tab bar -->
        <div class="bg-gray-800 border-b border-gray-700 px-4 py-2">
          <div class="flex space-x-1">
            ${session.tabs.map((tab, index) => html`
              <button
                class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
                  index === session.activeTab
                    ? 'bg-gray-700 text-white border-b-2 border-blue-500'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700'
                }"
                onclick="switchTab(${index})"
              >
                ${tab.name}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Iframe region -->
        <div class="h-full">
          <iframe
            id="terminal-iframe"
            class="w-full h-full border-0"
            src="/tab/${sessionId}/${session.tabs[session.activeTab].id}"
          ></iframe>
        </div>

        <script>
          function switchTab(tabIndex) {
            fetch('/session/${sessionId}/tabs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ activeTab: tabIndex })
            }).then(() => {
              // Update iframe src
              const tabs = ${JSON.stringify(session.tabs)};
              const iframe = document.getElementById('terminal-iframe');
              iframe.src = '/tab/${sessionId}/' + tabs[tabIndex].id;
            });
          }
        </script>
      </body>
    </html>
  `);
});

// Tab page - serves iframe content with terminal
app.get('/tab/:sessionId/:tabId', (c) => {
  const sessionId = c.req.param('sessionId');
  const tabId = c.req.param('tabId');

  return c.html(html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Terminal ${tabId}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link
          rel="stylesheet"
          href="https://unpkg.com/@xterm/xterm@6.0.0/css/xterm.css"
        />
      </head>
      <body class="bg-black h-screen overflow-hidden">
        <div id="terminal" class="h-full w-full"></div>
        <script>
          (function() {
            function loadScript(src) {
              return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = src;
                script.onload = resolve;
                script.onerror = reject;
                document.body.appendChild(script);
              });
            }

            async function init() {
              try {
                await loadScript('https://unpkg.com/@xterm/xterm@6.0.0/lib/xterm.js');
                await loadScript('https://unpkg.com/@xterm/addon-fit@0.11.0/lib/addon-fit.js');

                const terminal = new Terminal({
                  cursorBlink: true,
                  fontSize: 14,
                  fontFamily: 'monospace',
                  theme: {
                    background: '#000000',
                    foreground: '#ffffff',
                    cursor: '#ffffff',
                  },
                });

                const fitAddon = new FitAddon.FitAddon();
                terminal.loadAddon(fitAddon);
                terminal.open(document.getElementById('terminal'));
                fitAddon.fit();

                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = \`\${protocol}//\${window.location.host}/terminal/${sessionId}/${tabId}/ws\`;

                console.log('[Frontend] Connecting to:', wsUrl);

                const ws = new WebSocket(wsUrl);
                ws.binaryType = 'arraybuffer';

                const textEncoder = new TextEncoder();
                const CMD_OUTPUT = '0';

                ws.addEventListener('open', () => {
                  console.log('[Frontend] WebSocket opened');
                  terminal.clear();

                  // ttyd handshake - send terminal size
                  const sizeMsg = JSON.stringify({
                    columns: terminal.cols,
                    rows: terminal.rows,
                  });
                  ws.send(textEncoder.encode(sizeMsg));
                });

                ws.addEventListener('message', (e) => {
                  if (typeof e.data === 'string') return;

                  if (e.data instanceof ArrayBuffer) {
                    const u8 = new Uint8Array(e.data);
                    if (u8.length === 0) return;

                    const cmd = String.fromCharCode(u8[0]);
                    const data = e.data.slice(1);

                    if (cmd === CMD_OUTPUT) {
                      terminal.write(new Uint8Array(data));
                    }
                  }
                });

                terminal.onData((data) => {
                  if (ws.readyState !== WebSocket.OPEN) return;
                  const payload = new Uint8Array(data.length * 3 + 1);
                  payload[0] = CMD_OUTPUT.charCodeAt(0);
                  const stats = textEncoder.encodeInto(data, payload.subarray(1));
                  ws.send(payload.subarray(0, stats.written + 1));
                });

                ws.addEventListener('error', (e) => {
                  console.error('[Frontend] WebSocket error:', e);
                });

                ws.addEventListener('close', (e) => {
                  console.log('[Frontend] WebSocket closed:', e.code, e.reason);
                });

                window.addEventListener('resize', () => {
                  fitAddon.fit();
                  if (ws.readyState === WebSocket.OPEN) {
                    const sizeMsg = JSON.stringify({
                      columns: terminal.cols,
                      rows: terminal.rows,
                    });
                    ws.send(textEncoder.encode(sizeMsg));
                  }
                });
              } catch (error) {
                console.error('[Frontend] Initialization error:', error);
                const terminalEl = document.getElementById('terminal');
                if (terminalEl) {
                  terminalEl.innerHTML = '<div class="text-white p-4">Failed to initialize terminal. Check console for details.</div>';
                }
              }
            }

            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', init);
            } else {
              init();
            }
          })();
        </script>
      </body>
    </html>
  `);
});

// Root endpoint - serves HTML terminal UI
app.get('/', (c) => {
  const protocol = c.req.url.startsWith('https://') ? 'wss:' : 'ws:';
  const host = new URL(c.req.url).host;
  const wsBaseUrl = `${protocol}//${host}`;

  return c.html(html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Terminal</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link
          rel="stylesheet"
          href="https://unpkg.com/@xterm/xterm@6.0.0/css/xterm.css"
        />
      </head>
      <body class="bg-black h-screen overflow-hidden">
        <div id="terminal" class="h-full w-full"></div>
        <script>
          (function() {
            function loadScript(src) {
              return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = src;
                script.onload = resolve;
                script.onerror = reject;
                document.body.appendChild(script);
              });
            }

            async function init() {
              try {
                await loadScript('https://unpkg.com/@xterm/xterm@6.0.0/lib/xterm.js');
                await loadScript('https://unpkg.com/@xterm/addon-fit@0.11.0/lib/addon-fit.js');

                const sessionId = new URLSearchParams(window.location.search).get('session') ||
                  crypto.randomUUID().slice(0, 8);

                const terminal = new Terminal({
                  cursorBlink: true,
                  fontSize: 14,
                  fontFamily: 'monospace',
                  theme: {
                    background: '#000000',
                    foreground: '#ffffff',
                    cursor: '#ffffff',
                  },
                });

                const fitAddon = new FitAddon.FitAddon();
                terminal.loadAddon(fitAddon);
                terminal.open(document.getElementById('terminal'));
                fitAddon.fit();

                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = \`\${protocol}//\${window.location.host}/terminal/\${sessionId}/ws\`;

                console.log('[Frontend] Connecting to:', wsUrl);

                const ws = new WebSocket(wsUrl);
                ws.binaryType = 'arraybuffer';

                const textEncoder = new TextEncoder();
                const CMD_OUTPUT = '0';

                ws.addEventListener('open', () => {
                  console.log('[Frontend] WebSocket opened');
                  terminal.clear();

                  // ttyd handshake - send terminal size (worker also sends this, but we send on resize)
                  const sizeMsg = JSON.stringify({
                    columns: terminal.cols,
                    rows: terminal.rows,
                  });
                  ws.send(textEncoder.encode(sizeMsg));
                });

                ws.addEventListener('message', (e) => {
                  if (typeof e.data === 'string') return;

                  if (e.data instanceof ArrayBuffer) {
                    const u8 = new Uint8Array(e.data);
                    if (u8.length === 0) return;

                    const cmd = String.fromCharCode(u8[0]);
                    const data = e.data.slice(1);

                    if (cmd === CMD_OUTPUT) {
                      terminal.write(new Uint8Array(data));
                    }
                  }
                });

                terminal.onData((data) => {
                  if (ws.readyState !== WebSocket.OPEN) return;
                  const payload = new Uint8Array(data.length * 3 + 1);
                  payload[0] = CMD_OUTPUT.charCodeAt(0);
                  const stats = textEncoder.encodeInto(data, payload.subarray(1));
                  ws.send(payload.subarray(0, stats.written + 1));
                });

                ws.addEventListener('error', (e) => {
                  console.error('[Frontend] WebSocket error:', e);
                });

                ws.addEventListener('close', (e) => {
                  console.log('[Frontend] WebSocket closed:', e.code, e.reason);
                });

                window.addEventListener('resize', () => {
                  fitAddon.fit();
                  if (ws.readyState === WebSocket.OPEN) {
                    const sizeMsg = JSON.stringify({
                      columns: terminal.cols,
                      rows: terminal.rows,
                    });
                    ws.send(textEncoder.encode(sizeMsg));
                  }
                });
              } catch (error) {
                console.error('[Frontend] Initialization error:', error);
                const terminalEl = document.getElementById('terminal');
                if (terminalEl) {
                  terminalEl.innerHTML = '<div class="text-white p-4">Failed to initialize terminal. Check console for details.</div>';
                }
              }
            }

            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', init);
            } else {
              init();
            }
          })();
        </script>
      </body>
    </html>
  `);
});

// Terminal start endpoint - starts ttyd process in sandbox
app.post('/terminal/:sessionId/:tabId/start', async (c) => {
  const sessionId = c.req.param('sessionId');
  const tabId = c.req.param('tabId');

  if (!sessionId || !tabId) {
    return c.json({ error: 'sessionId and tabId required' }, 400);
  }

  // Local dev: return success (container server handles ttyd)
  if (isLocalDev(c)) {
    return c.json({ success: true, sessionId, tabId, message: 'Local dev mode - container server handles ttyd' });
  }

  // Production: use Sandbox to start ttyd with Effect
  try {
    const sandboxId = `${sessionId}:${tabId}`;
    const sandbox = getSandbox(c.env!.Sandbox!, sandboxId);

    // Wrap sandbox operations in Effect with retry and timeout
    const startTtydEffect = Effect.gen(function* () {
      console.log(`[Worker] Starting ttyd for session: ${sessionId}, tab: ${tabId}`);
      const ttyd = yield* Effect.tryPromise({
        try: () => sandbox.startProcess('ttyd -W -p 7681 bash'),
        catch: (error) => new ContainerError(`Failed to start ttyd process: ${String(error)}`, error),
      });

      console.log(`[Worker] Waiting for port 7681...`);
      yield* Effect.tryPromise({
        try: () => ttyd.waitForPort(7681, { mode: 'tcp', timeout: 30000 }),
        catch: (error) => new ContainerError(`Port 7681 not ready: ${String(error)}`, error),
      });

      console.log(`[Worker] ttyd ready on port 7681 for session: ${sessionId}, tab: ${tabId}`);
      return ttyd;
    }).pipe(
      (effect) => retryWithBackoff(effect, 3),
      (effect) => withTimeout(effect, 30000)
    );

    await Effect.runPromise(startTtydEffect);
    return c.json({ success: true, sessionId, tabId });
  } catch (error) {
    const errorMsg = String(error);
    // If containers aren't enabled, fall back to local dev response
    if (errorMsg.includes('Containers have not been enabled')) {
      console.log(`[Worker] Containers not enabled, returning local dev response for session: ${sessionId}, tab: ${tabId}`);
      return c.json({ success: true, sessionId, tabId, message: 'Local dev mode - container server handles ttyd' });
    }
    // Handle Effect errors
    if (error && typeof error === 'object' && '_tag' in error) {
      const effectError = error as { _tag: string; message?: string; cause?: unknown };
      console.error(`[Worker] Effect error (${effectError._tag}):`, effectError.message || errorMsg);
      return c.json({
        error: effectError.message || errorMsg,
        errorType: effectError._tag,
        message: 'Failed to start terminal',
      }, 500);
    }
    console.error(`[Worker] Failed to start ttyd for session ${sessionId}, tab ${tabId}:`, error);
    return c.json({
      error: errorMsg,
      message: 'Failed to start terminal',
      stack: error instanceof Error ? error.stack : undefined,
    }, 500);
  }
});

// WebSocket terminal connection endpoint
app.get('/terminal/:sessionId/:tabId/ws', async (c) => {
  const upgrade = c.req.header('Upgrade');
  if (upgrade?.toLowerCase() !== 'websocket') {
    return c.text('Expected WebSocket upgrade', 400);
  }

  const sessionId = c.req.param('sessionId');
  const tabId = c.req.param('tabId');
  if (!sessionId || !tabId) {
    return c.text('sessionId and tabId required', 400);
  }

  // Local dev: proxy to container server WebSocket
  if (isLocalDev(c)) {
    const containerUrl = c.env?.CONTAINER_URL || 'http://localhost:8085';
    const wsUrl = containerUrl.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws';
    console.log(`[Worker] Local dev mode: Connecting to container at ${wsUrl}`);

    // Return 101 with client WebSocket, proxy connections
    const pair = new WebSocketPair() as { 0: WebSocket; 1: WebSocket & { accept(): void } };
    const client = pair[0];
    const server = pair[1];
    (server as any).accept();

        // Connect to container's ttyd WebSocket
        (async () => {
          try {
            console.log(`[Worker] Connecting to container ttyd for session: ${sessionId}, tab: ${tabId} at ${wsUrl}`);
            const containerWs = new WebSocket(wsUrl);

        containerWs.addEventListener('open', () => {
          console.log('[Worker] Connected to container ttyd');
        });

        containerWs.addEventListener('message', (event: MessageEvent) => {
          console.log('[Worker] Received from container:', {
            type: typeof event.data,
            length: event.data instanceof ArrayBuffer ? event.data.byteLength : event.data?.length,
          });
          if (server.readyState === WebSocket.OPEN) {
            server.send(event.data); // Forward data FROM ttyd (containerWs) TO client (server)
          }
        });

        containerWs.addEventListener('close', () => {
          console.log('[Worker] Container ttyd WebSocket closed');
          if (server.readyState === WebSocket.OPEN) {
            server.close();
          }
        });

        containerWs.addEventListener('error', (event: Event) => {
          console.error('[Worker] Container ttyd WebSocket error:', event);
          server.close(1011, 'Container WebSocket error');
        });

        server.addEventListener('message', (event: MessageEvent) => {
          if (containerWs.readyState === WebSocket.OPEN) {
            containerWs.send(event.data);
          }
        });

        server.addEventListener('close', () => {
          console.log('[Worker] Client WebSocket closed');
          containerWs.close();
        });
      } catch (error) {
        console.error(`[Worker] WebSocket proxy error:`, error);
        server.close(1011, String(error));
      }
    })();

    return new Response(null, {
      status: 101,
      webSocket: client,
    } as ResponseInit & { webSocket: WebSocket });
  }

  // Production: use Sandbox WebSocket with Effect
  try {
    const sandboxId = `${sessionId}:${tabId}`;
    const sandbox = getSandbox(c.env!.Sandbox!, sandboxId);

    // Create WebSocketPair for client connection
    const pair = new WebSocketPair() as { 0: WebSocket; 1: WebSocket & { accept(): void } };
    const client = pair[0];
    const server = pair[1];
    (server as any).accept();

    // Connect to ttyd asynchronously with Effect
    (async () => {
      try {
        console.log(`[Worker] Connecting to ttyd for session: ${sessionId}, tab: ${tabId}`);

        // Rewrite URL to /ws for ttyd
        const originalUrl = new URL(c.req.url);
        const ttydUrl = new URL('/ws', originalUrl.origin);
        const wsRequest = new Request(ttydUrl.toString(), {
          method: c.req.raw.method,
          headers: c.req.raw.headers,
        });

        // Wrap wsConnect in Effect with retry and timeout
        const connectWsEffect = Effect.gen(function* () {
          console.log(`[Worker] Calling sandbox.wsConnect to port 7681...`);
          const ttydResponse = yield* Effect.tryPromise({
            try: () => sandbox.wsConnect(wsRequest, 7681) as Promise<Response & { webSocket?: WebSocket }>,
            catch: (error) => new WebSocketError(`Failed to connect WebSocket: ${String(error)}`, error),
          });

          if (ttydResponse.status !== 101 || !ttydResponse.webSocket) {
            yield* Effect.fail(new WebSocketError(`ttyd connection failed: status ${ttydResponse.status}`));
          }

          return ttydResponse.webSocket!;
        }).pipe(
          (effect) => retryWithBackoff(effect, 3),
          (effect) => withTimeout(effect, 30000)
        );

        const ttydWs: WebSocket = await Effect.runPromise(connectWsEffect);
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
        // Handle Effect errors
        if (error && typeof error === 'object' && '_tag' in error) {
          const effectError = error as { _tag: string; message?: string; cause?: unknown };
          console.error(`[Worker] Effect error (${effectError._tag}):`, effectError.message || String(error));
          server.close(1011, effectError.message || 'WebSocket connection failed');
        } else {
          console.error(`[Worker] WebSocket connection error:`, error);
          server.close(1011, String(error));
        }
      }
    })();

    return new Response(null, {
      status: 101,
      webSocket: client,
    } as ResponseInit & { webSocket: WebSocket });
  } catch (error) {
    const errorMsg = String(error);
    // If containers aren't enabled, fall back to local dev
    if (errorMsg.includes('Containers have not been enabled')) {
      console.log(`[Worker] Containers not enabled, falling back to local dev WebSocket for session: ${sessionId}, tab: ${tabId}`);
      const containerUrl = c.env?.CONTAINER_URL || 'http://localhost:8085';
      const wsUrl = containerUrl.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws';

      const pair = new WebSocketPair() as { 0: WebSocket; 1: WebSocket & { accept(): void } };
      const client = pair[0];
      const server = pair[1];
      (server as any).accept();

      (async () => {
        try {
          console.log(`[Worker] Connecting to container ttyd for session: ${sessionId}, tab: ${tabId}`);
          const containerWs = new WebSocket(wsUrl);

          containerWs.addEventListener('open', () => {
            console.log('[Worker] Connected to container ttyd');
          });

          containerWs.addEventListener('message', (event: MessageEvent) => {
            if (server.readyState === WebSocket.OPEN) {
              server.send(event.data);
            }
          });

          containerWs.addEventListener('close', () => {
            console.log('[Worker] Container ttyd WebSocket closed');
            if (server.readyState === WebSocket.OPEN) {
              server.close();
            }
          });

          containerWs.addEventListener('error', (event: Event) => {
            console.error('[Worker] Container ttyd WebSocket error:', event);
            server.close(1011, 'Container WebSocket error');
          });

          server.addEventListener('message', (event: MessageEvent) => {
            if (containerWs.readyState === WebSocket.OPEN) {
              containerWs.send(event.data);
            }
          });

          server.addEventListener('close', () => {
            console.log('[Worker] Client WebSocket closed');
            containerWs.close();
          });
        } catch (fallbackError) {
          console.error(`[Worker] WebSocket proxy error:`, fallbackError);
          server.close(1011, String(fallbackError));
        }
      })();

      return new Response(null, {
        status: 101,
        webSocket: client,
      } as ResponseInit & { webSocket: WebSocket });
    }
    console.error(`[Worker] Failed to create WebSocket connection:`, error);
    return c.json({
      error: errorMsg,
      message: 'Failed to create WebSocket connection',
      stack: error instanceof Error ? error.stack : undefined,
    }, 500);
  }
});

export { app };

export default {
  fetch: app.fetch.bind(app),
};
