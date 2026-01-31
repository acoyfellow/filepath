import { DurableObject } from 'cloudflare:workers'
import { getSandbox, Sandbox } from '@cloudflare/sandbox'

// Re-export Sandbox for Container binding
export { Sandbox }

// Track active terminals and their processes
const activeTerminals = new Set<string>();
const terminalProcesses = new Map<string, { kill: (signal?: string) => Promise<void> }>();

// CORS headers for cross-origin requests from myfilepath.com
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function withCors(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    newHeaders.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

// Render terminal HTML page with xterm.js
function renderTerminalPage(sessionId: string, tabId: string, apiWsHost?: string): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Terminal ${tabId}</title>
  <link rel="stylesheet" href="https://unpkg.com/@xterm/xterm@6.0.0/css/xterm.css" />
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background: #000; overflow: hidden; }
    #terminal { height: 100%; width: 100%; }
  </style>
</head>
<body>
  <div id="terminal"></div>
  <script src="https://unpkg.com/@xterm/xterm@6.0.0/lib/xterm.js"></script>
  <script src="https://unpkg.com/@xterm/addon-fit@0.11.0/lib/addon-fit.js"></script>
  <script>
    (function() {
      var terminal = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'monospace',
        theme: { background: '#000000', foreground: '#ffffff', cursor: '#ffffff' }
      });
      var fitAddon = new FitAddon.FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(document.getElementById('terminal'));
      fitAddon.fit();

      terminal.write('\\x1b[2J\\x1b[H');
      terminal.writeln('\\r\\n  Starting terminal...\\r\\n');

      var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      var apiWsHost = ${JSON.stringify(apiWsHost || '')};
      var httpBase = apiWsHost ? ('https://' + apiWsHost) : window.location.origin;
      var wsHost = apiWsHost || window.location.host;

      function reportStatus(status) {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(
            { type: 'terminal-status', tabId: '${tabId}', status: status },
            '*'
          );
        }
      }

      // Start terminal
      fetch(httpBase + '/terminal/${sessionId}/${tabId}/start', { method: 'POST' })
        .then(function(res) {
          if (!res.ok) throw new Error('Start failed: ' + res.status);
          terminal.writeln('  Terminal started, connecting...\\r\\n');
          connect();
        })
        .catch(function(err) {
          terminal.writeln('\\r\\n  [error] ' + err.message + '\\r\\n');
          reportStatus('expired');
        });

      var textEncoder = new TextEncoder();
      var CMD_OUTPUT = '0';
      var retries = 0;
      var maxRetries = 10;
      var ws = null;

      function connect() {
        var wsUrl = protocol + '//' + wsHost + '/terminal/${sessionId}/${tabId}/ws';
        ws = new WebSocket(wsUrl);
        ws.binaryType = 'arraybuffer';

        ws.addEventListener('open', function() {
          retries = 0;
          terminal.clear();
          terminal.writeln('[connected]');
          var sizeMsg = JSON.stringify({ columns: terminal.cols, rows: terminal.rows });
          ws.send(sizeMsg);
          reportStatus('connected');
        });

        ws.addEventListener('message', function(e) {
          if (typeof e.data === 'string') return;
          if (e.data instanceof ArrayBuffer) {
            var u8 = new Uint8Array(e.data);
            if (u8.length === 0) return;
            var cmd = String.fromCharCode(u8[0]);
            var data = e.data.slice(1);
            if (cmd === CMD_OUTPUT || cmd) {
              terminal.write(new Uint8Array(data));
            }
          }
        });

        terminal.onData(function(data) {
          if (ws.readyState !== WebSocket.OPEN) return;
          var payload = new Uint8Array(data.length * 3 + 1);
          payload[0] = CMD_OUTPUT.charCodeAt(0);
          var stats = textEncoder.encodeInto(data, payload.subarray(1));
          ws.send(payload.subarray(0, stats.written + 1));
        });

        function sendResize() {
          if (ws.readyState !== WebSocket.OPEN) return;
          var sizeMsg = JSON.stringify({ columns: terminal.cols, rows: terminal.rows });
          ws.send(sizeMsg);
        }

        window.addEventListener('resize', function() {
          fitAddon.fit();
          sendResize();
        });
        terminal.onResize(sendResize);

        ws.addEventListener('close', function() {
          if (retries < maxRetries) {
            retries++;
            var waitMs = Math.min(500 * retries, 5000);
            terminal.writeln('\\r\\n[disconnected, reconnecting in ' + waitMs + 'ms...]\\r\\n');
            setTimeout(connect, waitMs);
          } else {
            terminal.writeln('\\r\\n[connection failed after ' + maxRetries + ' attempts]\\r\\n');
            reportStatus('expired');
          }
        });

        ws.addEventListener('error', function() {
          terminal.writeln('\\r\\n[connection error]\\r\\n');
        });
      }
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

type Tab = {
  id: string;
  name: string;
};

type SessionState = {
  tabs: Tab[];
  activeTabId: string;
};

type Env = {
  SESSION_DO: DurableObjectNamespace<SessionDO>;
  Sandbox: any; // Container binding
  API_WS_HOST?: string; // e.g. 'api.myfilepath.com'
};

export class SessionDO extends DurableObject {
  private state: SessionState | null = null;
  private connections: Set<WebSocket> = new Set();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // WebSocket upgrade for real-time session updates
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    // Initialize state if needed
    if (!this.state) {
      this.state = await this.ctx.storage.get<SessionState>('state') || {
        tabs: [{ id: 'tab1', name: 'Terminal 1' }],
        activeTabId: 'tab1'
      };
    }

    // GET /state - get session state
    if (url.pathname === '/state' && request.method === 'GET') {
      return Response.json(this.state);
    }

    // POST /tab - create new tab
    if (url.pathname === '/tab' && request.method === 'POST') {
      const tabId = `tab${Date.now()}`;
      const tabNum = this.state.tabs.length + 1;
      const newTab: Tab = { id: tabId, name: `Terminal ${tabNum}` };
      
      this.state.tabs.push(newTab);
      this.state.activeTabId = tabId;
      await this.saveState();
      this.broadcast({ type: 'tabs', tabs: this.state.tabs, activeTabId: this.state.activeTabId });
      
      return Response.json({ tab: newTab, state: this.state });
    }

    // DELETE /tab/:id - close tab
    if (url.pathname.startsWith('/tab/') && request.method === 'DELETE') {
      const tabId = url.pathname.split('/')[2];
      const idx = this.state.tabs.findIndex(t => t.id === tabId);
      
      if (idx === -1) {
        return Response.json({ error: 'Tab not found' }, { status: 404 });
      }
      
      this.state.tabs.splice(idx, 1);
      
      // If we deleted the active tab, switch to another
      if (this.state.activeTabId === tabId && this.state.tabs.length > 0) {
        this.state.activeTabId = this.state.tabs[Math.max(0, idx - 1)].id;
      }
      
      await this.saveState();
      this.broadcast({ type: 'tabs', tabs: this.state.tabs, activeTabId: this.state.activeTabId });
      
      return Response.json({ state: this.state });
    }

    // POST /active/:tabId - switch active tab
    if (url.pathname.startsWith('/active/') && request.method === 'POST') {
      const tabId = url.pathname.split('/')[2];
      const tab = this.state.tabs.find(t => t.id === tabId);
      
      if (!tab) {
        return Response.json({ error: 'Tab not found' }, { status: 404 });
      }
      
      this.state.activeTabId = tabId;
      await this.saveState();
      this.broadcast({ type: 'tabs', tabs: this.state.tabs, activeTabId: this.state.activeTabId });
      
      return Response.json({ state: this.state });
    }

    return new Response('Not found', { status: 404 });
  }

  private handleWebSocket(request: Request): Response {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    
    this.ctx.acceptWebSocket(server);
    this.connections.add(server);
    
    // Send current state on connect
    if (this.state) {
      server.send(JSON.stringify({ type: 'tabs', tabs: this.state.tabs, activeTabId: this.state.activeTabId }));
    }
    
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketClose(ws: WebSocket) {
    this.connections.delete(ws);
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    // Handle incoming messages if needed
    try {
      const data = JSON.parse(message as string);
      // Future: handle client commands
    } catch {}
  }

  private broadcast(message: object) {
    const payload = JSON.stringify(message);
    for (const ws of this.connections) {
      try {
        ws.send(payload);
      } catch {
        this.connections.delete(ws);
      }
    }
  }

  private async saveState() {
    if (this.state) {
      await this.ctx.storage.put('state', this.state);
    }
  }
}

export default {
  async fetch(request: Request, env: Env) {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      // Handle terminal HTML page: /terminal/{sessionId}/tab?tab={tabId}
      // This serves the xterm.js page that connects to the terminal
      const terminalPageMatch = pathname.match(/^\/terminal\/([^/]+)\/tab$/);
      if (terminalPageMatch && request.method === 'GET') {
        const sessionId = terminalPageMatch[1];
        const tabId = url.searchParams.get('tab') || 'tab1';
        const apiWsHost = env.API_WS_HOST;
        return renderTerminalPage(sessionId, tabId, apiWsHost);
      }

      // Handle terminal start: /terminal/{sessionId}/{tabId}/start
      if (pathname.match(/^\/terminal\/[^/]+\/[^/]+\/start$/) && request.method === 'POST') {
        const parts = pathname.split('/');
        const sessionId = parts[2];
        const tabId = parts[3];
        const terminalId = `t-${sessionId.replace(/[^a-z0-9-]/gi, '')}-${tabId.replace(/[^a-z0-9-]/gi, '')}`;
        
        if (activeTerminals.has(terminalId)) {
          return withCors(Response.json({ success: true, terminalId, reused: true }));
        }
        
        let ttyd: { kill: (signal?: string) => Promise<void>; waitForPort: (port: number, opts: { mode: string; timeout: number }) => Promise<void> } | null = null;
        try {
          const sandbox = getSandbox(env.Sandbox, terminalId);
          
          console.info('[terminal/start]', 'starting', { terminalId });
          
          // Start ttyd with bash (opencode can be added later)
          ttyd = await sandbox.startProcess('ttyd -W -p 7681 bash');
          
          // Skip waitForPort in prod - it's unreliable and times out
          // The WebSocket connection will retry until ttyd is ready
          console.info('[terminal/start]', 'process started, skipping waitForPort', { terminalId });
          
          activeTerminals.add(terminalId);
          terminalProcesses.set(terminalId, ttyd);
          
          console.info('[terminal/start]', 'ready', { terminalId });
          return withCors(Response.json({ success: true, terminalId }));
        } catch (error) {
          console.error('[terminal/start]', error);
          // Cleanup on failure
          if (ttyd) {
            try { await ttyd.kill('SIGTERM'); } catch {}
          }
          activeTerminals.delete(terminalId);
          terminalProcesses.delete(terminalId);
          return withCors(Response.json(
            { error: 'Failed to start terminal', message: String(error) },
            { status: 500 }
          ));
        }
      }

      // Handle terminal WebSocket: /terminal/{sessionId}/{tabId}/ws
      if (pathname.match(/^\/terminal\/[^/]+\/[^/]+\/ws$/) && request.headers.get('Upgrade') === 'websocket') {
        const parts = pathname.split('/');
        const sessionId = parts[2];
        const tabId = parts[3];
        const terminalId = `t-${sessionId.replace(/[^a-z0-9-]/gi, '')}-${tabId.replace(/[^a-z0-9-]/gi, '')}`;
        
        try {
          const sandbox = getSandbox(env.Sandbox, terminalId);
          
          // Create WebSocket pair for client connection
          const pair = new WebSocketPair();
          const [client, server] = Object.values(pair);
          (server as any).accept();
          
          console.info('[terminal/ws]', 'connecting to ttyd', { terminalId });
          
          // Connect to ttyd via sandbox.wsConnect
          const wsRequest = new Request('http://localhost/ws', {
            headers: new Headers({
              'Upgrade': 'websocket',
              'Sec-WebSocket-Protocol': 'tty'
            })
          });
          
          // Retry connection to ttyd (may take time to start)
          let ttydResponse: Response & { webSocket?: WebSocket } | null = null;
          for (let attempt = 0; attempt < 20; attempt++) {
            try {
              ttydResponse = await sandbox.wsConnect(wsRequest, 7681) as Response & { webSocket?: WebSocket };
              if (ttydResponse.status === 101 && ttydResponse.webSocket) {
                break;
              }
            } catch (e) {
              console.warn('[terminal/ws]', 'wsConnect attempt failed', { attempt, error: String(e) });
            }
            await new Promise(r => setTimeout(r, 500));
          }
          
          if (!ttydResponse || ttydResponse.status !== 101 || !ttydResponse.webSocket) {
            console.error('[terminal/ws]', 'failed to connect to ttyd', { terminalId });
            server.close(1011, 'ttyd connection failed');
            return new Response('ttyd connection failed', { status: 502 });
          }
          
          const ttydWs = ttydResponse.webSocket;
          (ttydWs as any).accept?.();
          
          console.info('[terminal/ws]', 'connected to ttyd', { terminalId });
          
          // Bridge the two WebSockets
          ttydWs.addEventListener('message', (event) => {
            if ((server as WebSocket).readyState === WebSocket.OPEN) {
              server.send(event.data);
            }
          });
          
          server.addEventListener('message', (event) => {
            if (ttydWs.readyState === WebSocket.OPEN) {
              ttydWs.send(event.data);
            }
          });
          
          server.addEventListener('close', () => {
            if (ttydWs.readyState === WebSocket.OPEN) {
              ttydWs.close();
            }
          });
          
          ttydWs.addEventListener('close', () => {
            if ((server as WebSocket).readyState === WebSocket.OPEN) {
              server.close();
            }
          });
          
          ttydWs.addEventListener('error', () => {
            if ((server as WebSocket).readyState === WebSocket.OPEN) {
              server.close(1011, 'ttyd websocket error');
            }
          });
          
          // Send initial size to ttyd (required to start output)
          await new Promise(r => setTimeout(r, 100));
          const sizeMsg = JSON.stringify({ columns: 80, rows: 24 });
          ttydWs.send(sizeMsg);
          
          return new Response(null, { status: 101, webSocket: client });
        } catch (error) {
          console.error('[terminal/ws]', error);
          return new Response('WebSocket connection failed', { status: 502 });
        }
      }

      // Handle session requests: /session/{sessionId}/*
      if (pathname.startsWith('/session/')) {
        const pathParts = pathname.split('/');
        const sessionId = pathParts[2];
        
        if (!sessionId || sessionId.length > 50) {
          return new Response('Invalid session ID', { status: 400 });
        }

        const id = env.SESSION_DO.idFromName(sessionId);
        const session = env.SESSION_DO.get(id);
        
        // Forward to DO with remaining path
        const doPath = '/' + pathParts.slice(3).join('/');
        const doUrl = new URL(doPath, request.url);
        return await session.fetch(new Request(doUrl, request));
      }

      return new Response("Not found", { status: 404 });
      
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({ error: 'Service temporarily unavailable' }), 
        { 
          status: 503, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
  }
};
