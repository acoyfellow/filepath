import { getSandbox, Sandbox } from '@cloudflare/sandbox';
import { Editor, Shell } from '@cloudflare/sandbox/openai';
export { Sandbox }; // export the Sandbox class for the worker

import { Agent, applyPatchTool, run, shellTool } from '@openai/agents';

// Helper functions for error handling
function isErrorWithProperties(error: unknown): error is {
  message?: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  status?: number;
  stack?: string;
} {
  return typeof error === 'object' && error !== null;
}

function getErrorMessage(error: unknown): string {
  if (isErrorWithProperties(error) && typeof error.message === 'string') {
    return error.message;
  }
  return String(error);
}

function getErrorStack(error: unknown): string | undefined {
  if (isErrorWithProperties(error) && typeof error.stack === 'string') {
    return error.stack;
  }
  return undefined;
}

async function handleRunRequest(
  request: Request,
  env: Env,
  sessionId: string
): Promise<Response> {
  console.debug('[openai-example]', 'handleRunRequest called', {
    method: request.method,
    url: request.url
  });

  try {
    // Parse request body
    console.debug('[openai-example]', 'Parsing request body');
    const body = (await request.json()) as { input?: string };
    const input = body.input;

    if (!input || typeof input !== 'string') {
      console.warn('[openai-example]', 'Invalid or missing input field', {
        input
      });
      return new Response(
        JSON.stringify({ error: 'Missing or invalid input field' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.info('[openai-example]', 'Processing request', {
      inputLength: input.length
    });

    // Get sandbox instance (reused for both shell and editor)
    console.debug('[openai-example]', 'Getting sandbox instance', {
      sandboxId: `session-${sessionId}`
    });
    const sandbox = getSandbox(env.Sandbox, `session-${sessionId}`);

    // Create shell (automatically collects results)
    console.debug('[openai-example]', 'Creating SandboxShell');
    const shell = new Shell(sandbox);

    // Create workspace editor
    console.debug('[openai-example]', 'Creating WorkspaceEditor', {
      root: '/workspace'
    });
    const editor = new Editor(sandbox, '/workspace');

    // Create agent with both shell and patch tools, auto-approval for web API
    console.debug('[openai-example]', 'Creating Agent', {
      name: 'Sandbox Studio',
      model: 'gpt-5.1'
    });
    const agent = new Agent({
      name: 'Sandbox Studio',
      model: 'gpt-5.1',
      instructions:
        'You can execute shell commands and edit files in the workspace. Use shell commands to inspect the repository and the apply_patch tool to create, update, or delete files. Keep responses concise and include command output when helpful.',
      tools: [
        shellTool({
          shell,
          needsApproval: false // Auto-approve for web API
        }),
        applyPatchTool({
          editor,
          needsApproval: false // Auto-approve for web API
        })
      ]
    });

    // Run the agent
    console.info('[openai-example]', 'Running agent', { input });
    const result = await run(agent, input);
    console.debug('[openai-example]', 'Agent run completed', {
      hasOutput: !!result.finalOutput,
      outputLength: result.finalOutput?.length || 0
    });

    // Combine and sort all results by timestamp for logging
    const allResults = [
      ...shell.results.map((r) => ({ type: 'command' as const, ...r })),
      ...editor.results.map((r) => ({ type: 'file' as const, ...r }))
    ].sort((a, b) => a.timestamp - b.timestamp);

    console.debug('[openai-example]', 'Results collected', {
      commandResults: shell.results.length,
      fileOperations: editor.results.length,
      totalResults: allResults.length
    });

    // Format response with combined and sorted results
    const response = {
      naturalResponse: result.finalOutput || null,
      commandResults: shell.results.sort((a, b) => a.timestamp - b.timestamp),
      fileOperations: editor.results.sort((a, b) => a.timestamp - b.timestamp)
    };

    console.info('[openai-example]', 'Request completed successfully');
    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    const errorStack = getErrorStack(error);
    console.error('[openai-example]', 'Error handling run request', {
      error: errorMessage,
      stack: errorStack
    });
    return new Response(
      JSON.stringify({
        error: errorMessage || 'Internal server error',
        naturalResponse: 'An error occurred while processing your request.',
        commandResults: [],
        fileOperations: []
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}

type TerminalTab = {
  id: string;
  name: string;
};

type SessionState = {
  id: string;
  tabs: TerminalTab[];
  activeTabId: string;
};

type TerminalTaskStatus = 'queued' | 'running' | 'done' | 'failed';

type TerminalTask = {
  id: string;
  sessionId: string;
  tabId: string;
  command: string;
  status: TerminalTaskStatus;
  createdAt: number;
  completedAt?: number;
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
};

type CommandActor = 'user' | 'agent';

type CommandAuditEntry = {
  id: string;
  sessionId: string;
  tabId: string;
  actor: CommandActor;
  command: string;
  status: TerminalTaskStatus;
  createdAt: number;
  completedAt?: number;
  exitCode?: number | null;
};

const sessions = new Map<string, SessionState>();
const sessionClients = new Map<string, Set<WebSocket>>();
const tasksBySession = new Map<string, TerminalTask[]>();
const auditBySession = new Map<string, CommandAuditEntry[]>();
const activeTerminals = new Set<string>();

function getOrCreateSession(sessionId: string): SessionState {
  const existing = sessions.get(sessionId);
  if (existing) return existing;

  const initialTab = { id: 'tab1', name: 'Terminal 1' };
  const session: SessionState = {
    id: sessionId,
    tabs: [initialTab],
    activeTabId: initialTab.id
  };
  sessions.set(sessionId, session);
  return session;
}

function broadcastSessionTabs(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;
  const payload = JSON.stringify({
    tabs: session.tabs,
    activeTabId: session.activeTabId
  });
  const clients = sessionClients.get(sessionId);
  if (!clients) return;
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function addTask(task: TerminalTask) {
  const tasks = tasksBySession.get(task.sessionId) || [];
  tasks.unshift(task);
  tasksBySession.set(task.sessionId, tasks.slice(0, 50));
}

function addAudit(entry: CommandAuditEntry) {
  const audit = auditBySession.get(entry.sessionId) || [];
  audit.unshift(entry);
  auditBySession.set(entry.sessionId, audit.slice(0, 200));
}

async function startTerminal(
  request: Request,
  env: Env,
  sessionId: string,
  tabId: string
): Promise<Response> {
  if (!env.Sandbox) {
    return Response.json(
      { error: 'Sandbox binding missing' },
      { status: 500 }
    );
  }

  const terminalId = `${sessionId}:${tabId}`;
  if (activeTerminals.has(terminalId)) {
    return Response.json({ success: true, sessionId, tabId, reused: true });
  }

  const sandbox = getSandbox(env.Sandbox, terminalId);
  const ttyd = await sandbox.startProcess('ttyd -W -p 7681 bash');
  try {
    const hostname = new URL(request.url).hostname;
    await sandbox.exposePort(7681, { hostname });
  } catch (error) {
    console.warn('[terminal] exposePort failed', error);
  }
  await ttyd.waitForPort(7681, { mode: 'tcp', timeout: 30000 });
  activeTerminals.add(terminalId);

  return Response.json({ success: true, sessionId, tabId });
}

function renderTerminalTabPage(sessionId: string, tabId: string): Response {
  const html = `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Terminal ${tabId}</title>
      <link
        rel="stylesheet"
        href="https://unpkg.com/@xterm/xterm@6.0.0/css/xterm.css"
      />
      <style>
        html, body { margin: 0; padding: 0; height: 100%; background: #000; }
        #terminal { height: 100%; width: 100%; }
      </style>
    </head>
    <body>
      <div id="terminal"></div>
      <script>
        (function() {
          function loadScript(src) {
            return new Promise((resolve, reject) => {
              var script = document.createElement('script');
              script.src = src;
              script.onload = resolve;
              script.onerror = reject;
              document.body.appendChild(script);
            });
          }

          async function init() {
            await loadScript('https://unpkg.com/@xterm/xterm@6.0.0/lib/xterm.js');
            await loadScript('https://unpkg.com/@xterm/addon-fit@0.11.0/lib/addon-fit.js');

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
            terminal.writeln('\\r\\n  Connecting to terminal...\\r\\n');

            await fetch('/terminal/${sessionId}/${tabId}/start', { method: 'POST' });

            var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            var wsUrl = protocol + '//' + window.location.host + '/terminal/${sessionId}/${tabId}/ws';
            var ws = new WebSocket(wsUrl, ['tty']);
            ws.binaryType = 'arraybuffer';

            var textEncoder = new TextEncoder();
            var CMD_OUTPUT = '0';

            ws.addEventListener('open', function() {
              terminal.clear();
              var sizeMsg = JSON.stringify({ columns: terminal.cols, rows: terminal.rows });
              ws.send(textEncoder.encode(sizeMsg));
              if (window.parent) {
                window.parent.postMessage(
                  { type: 'terminal-status', tabId: '${tabId}', status: 'connected' },
                  window.location.origin
                );
              }
            });

            ws.addEventListener('message', function(e) {
              if (typeof e.data === 'string') return;
              if (e.data instanceof ArrayBuffer) {
                var u8 = new Uint8Array(e.data);
                if (u8.length === 0) return;
                var cmd = String.fromCharCode(u8[0]);
                var data = e.data.slice(1);
                if (cmd === CMD_OUTPUT) {
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
              ws.send(textEncoder.encode(sizeMsg));
            }

            window.addEventListener('resize', function() {
              fitAddon.fit();
              sendResize();
            });
            terminal.onResize(sendResize);

            ws.addEventListener('close', function() {
              if (window.parent) {
                window.parent.postMessage(
                  { type: 'terminal-status', tabId: '${tabId}', status: 'expired' },
                  window.location.origin
                );
              }
            });

            ws.addEventListener('error', function() {
              if (window.parent) {
                window.parent.postMessage(
                  { type: 'terminal-status', tabId: '${tabId}', status: 'expired' },
                  window.location.origin
                );
              }
            });
          }

          init().catch(function(err) {
            console.error('[Terminal] init failed', err);
            var el = document.getElementById('terminal');
            if (el) {
              el.innerHTML = '<div style="color:#fff;padding:16px">Failed to initialize terminal</div>';
            }
            if (window.parent) {
              window.parent.postMessage(
                { type: 'terminal-status', tabId: '${tabId}', status: 'expired' },
                window.location.origin
              );
            }
          });
        })();
      </script>
    </body>
  </html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

async function handleTerminalWebSocket(
  request: Request,
  env: Env,
  sessionId: string,
  tabId: string
): Promise<Response> {
  if (!env.Sandbox) {
    return new Response('Sandbox binding missing', { status: 500 });
  }

  const upgrade = request.headers.get('Upgrade');
  if (!upgrade || upgrade.toLowerCase() !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 400 });
  }

  const pair = new WebSocketPair() as {
    0: WebSocket;
    1: WebSocket & { accept(): void };
  };
  const client = pair[0];
  const server = pair[1];
  server.accept();

  (async () => {
    try {
      const sandbox = getSandbox(env.Sandbox!, `${sessionId}:${tabId}`);
      const url = new URL(request.url);
      url.pathname = '/ws';
      const wsRequest = new Request(url.toString(), {
        headers: request.headers,
        method: 'GET'
      });

      const ttydResponse = (await sandbox.wsConnect(
        wsRequest,
        7681
      )) as Response & { webSocket?: WebSocket };

      if (ttydResponse.status !== 101 || !ttydResponse.webSocket) {
        server.close(1011, 'ttyd connection failed');
        return;
      }

      const ttydWs = ttydResponse.webSocket;
      (ttydWs as any).accept?.();

      ttydWs.addEventListener('message', (event) => {
        if (server.readyState === WebSocket.OPEN) {
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
        if (server.readyState === WebSocket.OPEN) {
          server.close();
        }
      });

      ttydWs.addEventListener('error', () => {
        if (server.readyState === WebSocket.OPEN) {
          server.close(1011, 'ttyd websocket error');
        }
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      const sizeMsg = JSON.stringify({ columns: 80, rows: 24 });
      ttydWs.send(sizeMsg);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      server.close(1011, message);
    }
  })();

  return new Response(null, {
    status: 101,
    webSocket: client
  } as ResponseInit & { webSocket: WebSocket });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    console.debug('[openai-example]', 'Fetch handler called', {
      pathname: url.pathname,
      method: request.method
    });

    if (url.pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
      return Response.json({});
    }

    if (url.pathname === '/run' && request.method === 'POST') {
      const sessionId = request.headers.get('X-Session-Id');
      if (!sessionId) {
        return new Response('Missing X-Session-Id header', { status: 400 });
      }

      return handleRunRequest(request, env, sessionId);
    }

    if (url.pathname === '/session' && request.method === 'POST') {
      const body = (await request.json().catch(() => null)) as
        | { sessionId?: string }
        | null;
      const sessionId =
        body?.sessionId && typeof body.sessionId === 'string'
          ? body.sessionId
          : crypto.randomUUID();
      const session = getOrCreateSession(sessionId);
      return Response.json({ sessionId: session.id });
    }

    const sessionInfoMatch = url.pathname.match(/^\/session\/([^/]+)\/tabs$/);
    if (sessionInfoMatch) {
      const sessionId = sessionInfoMatch[1];
      const session = getOrCreateSession(sessionId);
      if (request.method === 'GET') {
        return Response.json({
          tabs: session.tabs,
          activeTabId: session.activeTabId
        });
      }
      if (request.method === 'POST') {
        const body = (await request.json()) as {
          tabs?: TerminalTab[];
          activeTabId?: string;
        };
        if (Array.isArray(body.tabs)) {
          session.tabs = body.tabs;
        }
        if (typeof body.activeTabId === 'string') {
          session.activeTabId = body.activeTabId;
        }
        broadcastSessionTabs(sessionId);
        return Response.json({ success: true });
      }
    }

    const sessionTabsWsMatch = url.pathname.match(
      /^\/session\/([^/]+)\/tabs\/ws$/
    );
    if (sessionTabsWsMatch && request.method === 'GET') {
      const upgrade = request.headers.get('Upgrade');
      if (!upgrade || upgrade.toLowerCase() !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 400 });
      }
      const sessionId = sessionTabsWsMatch[1];
      const session = getOrCreateSession(sessionId);

      const pair = new WebSocketPair() as {
        0: WebSocket;
        1: WebSocket & { accept(): void };
      };
      const client = pair[0];
      const server = pair[1];
      server.accept();

      const clients =
        sessionClients.get(sessionId) || new Set<WebSocket>();
      clients.add(server);
      sessionClients.set(sessionId, clients);

      server.send(
        JSON.stringify({ tabs: session.tabs, activeTabId: session.activeTabId })
      );

      server.addEventListener('close', () => {
        clients.delete(server);
      });

      return new Response(null, {
        status: 101,
        webSocket: client
      } as ResponseInit & { webSocket: WebSocket });
    }

    const sessionTasksMatch = url.pathname.match(/^\/session\/([^/]+)\/tasks$/);
    if (sessionTasksMatch && request.method === 'GET') {
      const sessionId = sessionTasksMatch[1];
      const tasks = tasksBySession.get(sessionId) || [];
      return Response.json({ tasks });
    }

    const sessionAuditMatch = url.pathname.match(/^\/session\/([^/]+)\/audit$/);
    if (sessionAuditMatch && request.method === 'GET') {
      const sessionId = sessionAuditMatch[1];
      const audit = auditBySession.get(sessionId) || [];
      return Response.json({ audit });
    }

    const terminalTabMatch = url.pathname.match(
      /^\/terminal\/([^/]+)\/([^/]+)\/(start|ws|task)$/
    );
    if (terminalTabMatch) {
      const [, sessionId, tabId, action] = terminalTabMatch;
      if (action === 'start' && request.method === 'POST') {
        return startTerminal(request, env, sessionId, tabId);
      }
      if (action === 'ws' && request.method === 'GET') {
        return handleTerminalWebSocket(request, env, sessionId, tabId);
      }
      if (action === 'task' && request.method === 'POST') {
        if (!env.Sandbox) {
          return Response.json(
            { error: 'Sandbox binding missing' },
            { status: 500 }
          );
        }

        const body = (await request.json().catch(() => null)) as
          | { command?: string; actor?: CommandActor }
          | null;
        const command =
          body?.command && typeof body.command === 'string'
            ? body.command
            : '';
        if (!command.trim()) {
          return Response.json({ error: 'Missing command' }, { status: 400 });
        }
        const actor: CommandActor =
          body?.actor === 'agent' || body?.actor === 'user'
            ? body.actor
            : 'agent';

        const task: TerminalTask = {
          id: crypto.randomUUID(),
          sessionId,
          tabId,
          command,
          status: 'queued',
          createdAt: Date.now()
        };
        addTask(task);
        const auditEntry: CommandAuditEntry = {
          id: crypto.randomUUID(),
          sessionId,
          tabId,
          actor,
          command,
          status: 'queued',
          createdAt: task.createdAt
        };
        addAudit(auditEntry);
        task.status = 'running';
        auditEntry.status = 'running';

        try {
          const sandbox = getSandbox(env.Sandbox, `${sessionId}:${tabId}`);
          const result = await sandbox.exec(command);
          task.status = 'done';
          task.completedAt = Date.now();
          task.exitCode = result.exitCode ?? null;
          task.stdout = result.stdout;
          task.stderr = result.stderr;
          auditEntry.status = 'done';
          auditEntry.completedAt = task.completedAt;
          auditEntry.exitCode = task.exitCode ?? null;
          return Response.json({ task });
        } catch (error) {
          task.status = 'failed';
          task.completedAt = Date.now();
          task.stderr = error instanceof Error ? error.message : String(error);
          auditEntry.status = 'failed';
          auditEntry.completedAt = task.completedAt;
          return Response.json({ task, error: task.stderr }, { status: 500 });
        }
      }
    }

    const terminalTabPageMatch = url.pathname.match(
      /^\/terminal\/([^/]+)\/tab$/
    );
    if (terminalTabPageMatch && request.method === 'GET') {
      const sessionId = terminalTabPageMatch[1];
      const tabId = url.searchParams.get('tab') || 'tab1';
      return renderTerminalTabPage(sessionId, tabId);
    }

    if (request.method === 'GET') {
      const assets = (env as Env & {
        ASSETS?: { fetch: (request: Request) => Promise<Response> };
      }).ASSETS;

      if (assets) {
        return assets.fetch(request);
      }
    }

    console.warn('[openai-example]', 'Route not found', {
      pathname: url.pathname,
      method: request.method
    });
    return new Response('Not found', { status: 404 });
  }
};
