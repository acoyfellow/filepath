import { DurableObject } from 'cloudflare:workers'
import { getSandbox, Sandbox } from '@cloudflare/sandbox'
import type { Process } from '@cloudflare/sandbox'
import { drizzle } from 'drizzle-orm/d1';
import { session as sessionTable, user as userTable, apikey as apikeyTable } from '../src/lib/schema';
import { eq, sql } from 'drizzle-orm';


// Re-export Sandbox for Container binding
export { Sandbox }

// Track active terminals and their processes
const activeTerminals = new Set<string>();
const terminalProcesses = new Map<string, Process>();

// Build a lowercase terminal ID from session + tab (hostnames are case-insensitive)
function makeTerminalId(sessionId: string, tabId: string): string {
  return `t-${sessionId.replace(/[^a-z0-9-]/gi, '')}-${tabId.replace(/[^a-z0-9-]/gi, '')}`.toLowerCase();
}

function makeTaskTerminalId(sessionId: string): string {
  return `task-${sessionId.replace(/[^a-z0-9-]/gi, '')}`.toLowerCase();
}

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
/**
 * Render terminal page for a pre-started agent container.
 * No /start call needed — container already has ttyd running.
 */
function renderAgentTerminalPage(containerId: string, apiWsHost?: string): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Agent Terminal</title>
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
      terminal.writeln('\\r\\n  Connecting to agent container...\\r\\n');

      var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      var apiWsHost = ${JSON.stringify(apiWsHost || '')};
      var wsHost = apiWsHost || window.location.host;
      var textEncoder = new TextEncoder();
      var CMD_OUTPUT = '0';
      var retries = 0;
      var maxRetries = 10;
      var ws = null;

      function connect() {
        var wsUrl = protocol + '//' + wsHost + '/agent-terminal/${containerId}/ws';
        ws = new WebSocket(wsUrl);
        ws.binaryType = 'arraybuffer';

        ws.addEventListener('open', function() {
          retries = 0;
          terminal.writeln('  Connected.\\r\\n');
          ws.send(JSON.stringify({ columns: terminal.cols, rows: terminal.rows }));
        });

        ws.addEventListener('message', function(event) {
          if (event.data instanceof ArrayBuffer) {
            var view = new Uint8Array(event.data);
            if (view.length > 0 && view[0] === CMD_OUTPUT.charCodeAt(0)) {
              terminal.write(view.slice(1));
            }
          } else if (typeof event.data === 'string') {
            if (event.data.charCodeAt(0) === CMD_OUTPUT.charCodeAt(0)) {
              terminal.write(event.data.slice(1));
            }
          }
        });

        ws.addEventListener('close', function() {
          if (retries < maxRetries) {
            retries++;
            terminal.writeln('\\r\\n  Reconnecting (' + retries + '/' + maxRetries + ')...');
            setTimeout(connect, 1000 * retries);
          } else {
            terminal.writeln('\\r\\n  Connection lost.');
          }
        });

        ws.addEventListener('error', function() {});

        terminal.onData(function(data) {
          if (ws && ws.readyState === WebSocket.OPEN) {
            var payload = new Uint8Array(data.length + 1);
            payload[0] = CMD_OUTPUT.charCodeAt(0);
            payload.set(textEncoder.encode(data), 1);
            ws.send(payload);
          }
        });

        terminal.onResize(function(size) {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ columns: size.cols, rows: size.rows }));
          }
        });
      }

      connect();

      window.addEventListener('resize', function() { fitAddon.fit(); });
    })();
  </script>
</body>
</html>`;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders },
  });
}

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
      terminal.writeln('  Requesting container...');
      fetch(httpBase + '/terminal/${sessionId}/${tabId}/start', { method: 'POST' })
        .then(function(res) {
          if (!res.ok) {
            if (res.status === 401) throw new Error('Session expired. Please create a new session.');
            if (res.status === 402) throw new Error('Insufficient credits. Add credits in billing settings.');
            throw new Error('Start failed (HTTP ' + res.status + ')');
          }
          terminal.writeln('  Container started, connecting...\\r\\n');
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
  Sandbox: DurableObjectNamespace<Sandbox>; // Container binding
  DB: D1Database; // Database binding
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

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  return _fetchHandler(request, env);
}

export default {
  async fetch(request: Request, env: Env) {
    return _fetchHandler(request, env);
  }
};

async function _fetchHandler(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      // Debug endpoint to test container
      if (pathname === '/debug/container') {
        try {
          const sandbox = getSandbox(env.Sandbox, 'debug-test');
          const result = await sandbox.exec('echo hello');
          return withCors(Response.json({ success: true, output: result }));
        } catch (error) {
          return withCors(Response.json({ error: String(error) }, { status: 500 }));
        }
      }

      // Start containers for multi-agent session slots
      if (pathname === '/start-agent-slots' && request.method === 'POST') {
        try {
          const body = await request.json() as {
            slots: Array<{ id: string; containerId: string }>;
          };

          if (!body.slots || !Array.isArray(body.slots)) {
            return withCors(Response.json({ error: 'slots array required' }, { status: 400 }));
          }

          const results: Array<{ slotId: string; containerId: string; status: string; error?: string }> = [];

          for (const slot of body.slots) {
            try {
              const sandbox = getSandbox(env.Sandbox, slot.containerId);
              await sandbox.startProcess('ttyd -W -p 7681 bash');
              results.push({ slotId: slot.id, containerId: slot.containerId, status: 'running' });
            } catch (err) {
              console.error(`Failed to start container ${slot.containerId}:`, err);
              results.push({
                slotId: slot.id,
                containerId: slot.containerId,
                status: 'error',
                error: String(err),
              });
            }
          }

          return withCors(Response.json({ success: true, results }));
        } catch (err) {
          return withCors(Response.json({ error: String(err) }, { status: 500 }));
        }
      }

      // Handle agent-terminal page: /agent-terminal/{containerId}
      // Serves xterm.js page that connects to a pre-started container directly
      const agentTerminalMatch = pathname.match(/^\/agent-terminal\/([a-z0-9-]+)$/);
      if (agentTerminalMatch && request.method === 'GET') {
        const containerId = agentTerminalMatch[1] ?? '';
        const apiWsHost = env.API_WS_HOST;
        return renderAgentTerminalPage(containerId, apiWsHost);
      }

      // Handle agent-terminal WebSocket: /agent-terminal/{containerId}/ws
      const agentTerminalWsMatch = pathname.match(/^\/agent-terminal\/([a-z0-9-]+)\/ws$/);
      if (agentTerminalWsMatch && request.headers.get('Upgrade') === 'websocket') {
        const containerId = agentTerminalWsMatch[1] ?? '';
        try {
          // Use containerId directly as sandbox name (no makeTerminalId transform)
          const sandbox = getSandbox(env.Sandbox, containerId);

          const pair = new WebSocketPair();
          const [client, server] = Object.values(pair);
          server.accept();

          const wsUrl = new URL(request.url);
          wsUrl.pathname = '/ws';
          const wsHeaders = new Headers(request.headers);
          if (!wsHeaders.get('Sec-WebSocket-Protocol')) {
            wsHeaders.set('Sec-WebSocket-Protocol', 'tty');
          }
          const wsRequest = new Request(wsUrl.toString(), {
            headers: wsHeaders,
            method: 'GET',
          });

          let ttydResponse: Response & { webSocket?: WebSocket } | null = null;
          for (let attempt = 0; attempt < 20; attempt++) {
            try {
              ttydResponse = await sandbox.wsConnect(wsRequest, 7681) as Response & { webSocket?: WebSocket };
              if (ttydResponse.status === 101 && ttydResponse.webSocket) break;
            } catch (e) {
              console.warn('[agent-terminal/ws]', 'wsConnect attempt failed', { attempt, error: String(e) });
            }
            await new Promise(r => setTimeout(r, 500));
          }

          if (!ttydResponse || ttydResponse.status !== 101 || !ttydResponse.webSocket) {
            server.close(1011, 'ttyd connection failed');
            return new Response('ttyd connection failed', { status: 502 });
          }

          const ttydWs = ttydResponse.webSocket;
          ttydWs?.accept?.();

          // Relay: client ↔ ttyd
          server.addEventListener('message', (event) => {
            try { ttydWs.send(event.data); } catch { /* ignore */ }
          });
          ttydWs.addEventListener('message', (event: MessageEvent) => {
            try { server.send(event.data); } catch { /* ignore */ }
          });
          server.addEventListener('close', () => { try { ttydWs.close(); } catch { /* */ } });
          ttydWs.addEventListener('close', () => { try { server.close(); } catch { /* */ } });

          return new Response(null, { status: 101, webSocket: client });
        } catch (err) {
          console.error('[agent-terminal/ws]', err);
          return withCors(Response.json({ error: String(err) }, { status: 500 }));
        }
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
        const terminalId = makeTerminalId(sessionId, tabId);
        
        // Check user credits before starting terminal
        const db = drizzle(env.DB);
        const creditCheck = await checkUserCredits(db, sessionId);
        
        if (!creditCheck.authenticated) {
          return withCors(Response.json(
            { error: 'Unauthorized', message: 'Invalid or expired session.' },
            { status: 401 }
          ));
        }
        
        if (!creditCheck.hasCredits) {
          return withCors(Response.json(
            { error: 'Insufficient credits', message: 'Please add credits to your account to start a terminal session.' },
            { status: 402 }
          ));
        }
        
        if (activeTerminals.has(terminalId)) {
          return withCors(Response.json({ success: true, terminalId, reused: true }));
        }
        
        let ttyd: Process | null = null;
        try {
          console.info('[terminal/start]', 'getting sandbox', { terminalId });
          const sandbox = getSandbox(env.Sandbox, terminalId);
          
          console.info('[terminal/start]', 'sandbox object', { terminalId, sandbox: typeof sandbox });
          
          console.info('[terminal/start]', 'starting', { terminalId });
          
          // Start ttyd with bash - with 30s timeout to avoid hanging
          console.info('[terminal/start]', 'calling startProcess', { terminalId, command: 'ttyd -W -p 7681 bash' });
          const startProcessStartTime = Date.now();
          try {
            const timeoutPromise = new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Container startup timed out after 30s')), 30000)
            );
            ttyd = await Promise.race([
              sandbox.startProcess('ttyd -W -p 7681 bash'),
              timeoutPromise
            ]);
            const startProcessDuration = Date.now() - startProcessStartTime;
            console.info('[terminal/start]', 'startProcess returned', { terminalId, duration: startProcessDuration });
          } catch (error) {
            const startProcessDuration = Date.now() - startProcessStartTime;
            console.error('[terminal/start]', 'startProcess failed', { terminalId, error: String(error), errorType: typeof error, errorKeys: typeof error === 'object' && error !== null ? Object.keys(error) : 'Not an object', duration: startProcessDuration });
            throw error;
          }
          
          // Skip waitForPort in prod - it's unreliable and times out
          // The WebSocket connection will retry until ttyd is ready
          console.info('[terminal/start]', 'process started, skipping waitForPort', { terminalId });
          
          activeTerminals.add(terminalId);
          terminalProcesses.set(terminalId, ttyd);
          
          console.info('[terminal/start]', 'ready', { terminalId });
          return withCors(Response.json({ success: true, terminalId }));
        } catch (error) {
          console.error('[terminal/start]', 'caught error', error);
          console.error('[terminal/start]', 'error type', typeof error);
          console.error('[terminal/start]', 'error keys', typeof error === 'object' && error !== null ? Object.keys(error) : 'Not an object');
          // Cleanup on failure
          if (ttyd !== null) {
            try { await (ttyd as Process).kill('SIGTERM'); } catch {}
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
        const terminalId = makeTerminalId(sessionId, tabId);
        
        try {
          const sandbox = getSandbox(env.Sandbox, terminalId);
          
          // Create WebSocket pair for client connection
          const pair = new WebSocketPair();
          const [client, server] = Object.values(pair);
          server.accept();
          
          console.info('[terminal/ws]', 'connecting to ttyd', { terminalId });
          
          // Connect to ttyd via sandbox.wsConnect
          // Preserve original request headers, ensure Sec-WebSocket-Protocol is set
          const wsUrl = new URL(request.url);
          wsUrl.pathname = '/ws';
          const wsHeaders = new Headers(request.headers);
          if (!wsHeaders.get('Sec-WebSocket-Protocol')) {
            wsHeaders.set('Sec-WebSocket-Protocol', 'tty');
          }
          const wsRequest = new Request(wsUrl.toString(), {
            headers: wsHeaders,
            method: 'GET'
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
          ttydWs?.accept?.();
          
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

        const doPath = '/' + pathParts.slice(3).join('/');
        const doUrl = new URL(doPath, request.url);
        return await session.fetch(new Request(doUrl, request));
      }

      const taskMatch = pathname.match(/^\/task\/([^\/]+)$/);
      if (taskMatch && request.method === 'POST') {
        const sessionId = taskMatch[1];

        if (!sessionId || sessionId.length > 50) {
          return withCors(Response.json({ error: 'Invalid session ID' }, { status: 400 }));
        }

        try {
          const body = await request.json() as {
            task: string;
            timeout?: number;
            env?: Record<string, string>;
            shell?: string;
            defaultDir?: string;
            apiKeyId: string;
            userId?: string;
          };

          const { task, timeout = 30000, env: envVars = {}, shell = 'bash', defaultDir = '/home/user', apiKeyId } = body;

          if (!task || typeof task !== 'string') {
            return withCors(Response.json({ error: 'Missing or invalid task' }, { status: 400 }));
          }

          if (!apiKeyId) {
            return withCors(Response.json({ error: 'Missing API key ID' }, { status: 401 }));
          }

          const db = drizzle(env.DB);
          const creditCheck = await checkApiKeyCredits(db, apiKeyId);

          if (!creditCheck.hasCredits) {
            return withCors(Response.json(
              { error: 'Insufficient credits. Please add credits to your API key.' },
              { status: 402 }
            ));
          }

          const terminalId = makeTaskTerminalId(sessionId);

          const sandbox = getSandbox(env.Sandbox, terminalId);

          const execOptions = {
            env: envVars,
            cwd: defaultDir,
            timeout,
          };

          const result = await sandbox.exec(task, execOptions);

          await deductApiKeyCredits(db, apiKeyId, 1);

          return withCors(Response.json({
            success: true,
            result: result.stdout || result.stderr || '',
            exitCode: result.exitCode,
            creditsRemaining: creditCheck.creditBalance ? creditCheck.creditBalance - 1 : 0,
          }));
        } catch (error) {
          console.error('[task] Error executing task:', error);
          return withCors(Response.json(
            { success: false, error: String(error) },
            { status: 500 }
          ));
        }
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

/**
 * Check if a user has sufficient credits to start a terminal session
 * @param db - Drizzle database instance
 * @param sessionId - Session ID (token) to check
 * @returns { authenticated: boolean, hasCredits: boolean, userId?: string, creditBalance?: number }
 */
async function checkUserCredits(db: ReturnType<typeof drizzle>, sessionId: string): Promise<{ 
  authenticated: boolean;
  hasCredits: boolean; 
  userId?: string; 
  creditBalance?: number 
}> {
  try {
    // Get session from database (try token first, then ID)
    let sessions = await db.select().from(sessionTable).where(eq(sessionTable.token, sessionId));
    
    if (sessions.length === 0) {
      sessions = await db.select().from(sessionTable).where(eq(sessionTable.id, sessionId));
    }
    
    if (sessions.length === 0) {
      console.warn('[billing-check]', 'Session not found:', sessionId.substring(0, 8) + '...');
      return { authenticated: false, hasCredits: false };
    }
    
    const session = sessions[0];
    
    // Get user
    const users = await db.select().from(userTable).where(eq(userTable.id, session.userId));
    if (users.length === 0) {
      console.warn('[billing-check]', 'User not found for session:', sessionId.substring(0, 8) + '...');
      return { authenticated: false, hasCredits: false };
    }
    
    const user = users[0];
    const creditBalance = user.creditBalance || 0;
    
    // Require at least 1 credit to start a terminal
    return { 
      authenticated: true,
      hasCredits: creditBalance >= 1, 
      userId: user.id, 
      creditBalance 
    };
  } catch (error) {
    console.error('[billing-check]', 'Error checking user credits:', error);
    return { authenticated: false, hasCredits: false };
  }
}

/**
 * Check if an API key has sufficient credits for task execution
 */
async function checkApiKeyCredits(db: ReturnType<typeof drizzle>, apiKeyId: string): Promise<{
  hasCredits: boolean;
  creditBalance?: number;
}> {
  try {
    const apiKeys = await db.select({
      creditBalance: apikeyTable.creditBalance
    }).from(apikeyTable).where(eq(apikeyTable.id, apiKeyId));

    if (apiKeys.length === 0) {
      return { hasCredits: false };
    }

    const apiKey = apiKeys[0];
    const creditBalance = apiKey.creditBalance ?? 0;

    return {
      hasCredits: creditBalance >= 1,
      creditBalance
    };
  } catch (error) {
    console.error('[billing-check]', 'Error checking API key credits:', error);
    return { hasCredits: false };
  }
}

/**
 * Deduct credits from an API key for task execution
 */
async function deductApiKeyCredits(db: ReturnType<typeof drizzle>, apiKeyId: string, credits: number): Promise<boolean> {
  try {
    const apiKeys = await db.select({
      creditBalance: apikeyTable.creditBalance
    }).from(apikeyTable).where(eq(apikeyTable.id, apiKeyId));

    if (apiKeys.length === 0) {
      return false;
    }

    const apiKey = apiKeys[0];
    if (apiKey.creditBalance === null || apiKey.creditBalance < credits) {
      return false;
    }

    await db.update(apikeyTable)
      .set({
        creditBalance: sql`${apikeyTable.creditBalance} - ${credits}`,
        totalUsageMinutes: sql`${apikeyTable.totalUsageMinutes} + 1`
      })
      .where(eq(apikeyTable.id, apiKeyId));

    return true;
  } catch (error) {
    console.error('[billing-check]', 'Error deducting API key credits:', error);
    return false;
  }
}
