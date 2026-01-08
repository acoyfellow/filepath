import { Hono } from "hono";
import { html } from "hono/html";

// Cloudflare Workers WebSocket types
declare const WebSocketPair: {
  new(): { 0: WebSocket; 1: WebSocket };
};
import { createSession, getSession, verifyPassword } from "./sessions";
import { connectWebSocket } from "./container";
import { Effect } from "effect";

type Env = {
  Sandbox: {
    fetch(request: Request): Promise<Response>;
  };
};

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => {
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
              await loadScript('https://unpkg.com/@xterm/xterm@6.0.0/lib/xterm.js');
              await loadScript('https://unpkg.com/@xterm/addon-fit@0.11.0/lib/addon-fit.js');
              await loadScript('https://unpkg.com/@xterm/addon-attach@0.12.0/lib/addon-attach.js');
              
              const sessionId = new URLSearchParams(window.location.search).get(
                "session"
              ) || crypto.randomUUID().slice(0, 8);
              
              const terminal = new Terminal();
              const fitAddon = new FitAddon.FitAddon();
              const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
              const wsUrl = \`\${protocol}//\${window.location.host}/terminal/\${sessionId}/ws\`;
              console.log('[Frontend] Connecting to:', wsUrl);
              
              const ws = new WebSocket(wsUrl);
              
              ws.addEventListener('open', () => {
                console.log('[Frontend] WebSocket opened');
              });
              
              ws.addEventListener('message', (e) => {
                console.log('[Frontend] Received message:', {
                  type: typeof e.data,
                  length: e.data instanceof ArrayBuffer ? e.data.byteLength : e.data?.length,
                });
              });
              
              ws.addEventListener('error', (e) => {
                console.error('[Frontend] WebSocket error:', e);
              });
              
              const attachAddon = new AttachAddon.AttachAddon(ws);

              terminal.loadAddon(fitAddon);
              terminal.loadAddon(attachAddon);
              terminal.open(document.getElementById("terminal"));
              fitAddon.fit();

              window.addEventListener("resize", () => fitAddon.fit());
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

app.post("/session", (c) => {
  const { password } = c.req.json().catch(() => ({})) as { password?: string };
  const session = createSession(password);
  return c.json({ sessionId: session.id });
});

app.get("/session/:id", (c) => {
  const session = getSession(c.req.param("id"));
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }
  return c.json({
    id: session.id,
    createdAt: session.createdAt,
    hasPassword: session.hasPassword,
  });
});

app.post("/session/:id/verify", async (c) => {
  const sessionId = c.req.param("id");
  const { password } = (await c.req.json().catch(() => ({}))) as {
    password?: string;
  };

  if (!password) {
    return c.json({ error: "Password required" }, 400);
  }

  const valid = verifyPassword(sessionId, password);
  return c.json({ valid });
});

app.post("/terminal/:sessionId/start", async (c) => {
  const sessionId = c.req.param("sessionId");
  const session = getSession(sessionId);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  return c.json({ success: true });
});

// TEST: Verify container is accessible
app.get("/test/container", async (c) => {
  const container = c.env.Sandbox;

  try {
    // Test 1: Can we reach the container at all?
    const testRequest = new Request("http://container:7681/", {
      method: "GET",
    });

    const response = await container.fetch(testRequest);
    const text = await response.text();

    return c.json({
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: text.substring(0, 200), // First 200 chars
    });
  } catch (error) {
    return c.json({
      error: String(error),
      message: "Container connection failed"
    }, 500);
  }
});

app.get("/terminal/:sessionId/ws", async (c) => {
  const upgrade = c.req.header("Upgrade");
  if (upgrade?.toLowerCase() !== "websocket") {
    return c.text("Expected WebSocket upgrade", 400);
  }

  const sessionId = c.req.param("sessionId");
  const containerBinding = c.env.Sandbox;
  
  console.log("[Worker] WebSocket route hit, sessionId:", sessionId);
  console.log("[Worker] Container binding type:", typeof containerBinding);
  console.log("[Worker] Container binding:", containerBinding);
  
  // Alchemy Container bindings are Durable Object namespaces
  // Need to get an instance first
  let container;
  try {
    // Try to get container instance - might need idFromName or get
    if (typeof (containerBinding as any).idFromName === 'function') {
      const id = (containerBinding as any).idFromName(sessionId);
      container = (containerBinding as any).get(id);
      console.log("[Worker] Got container via idFromName");
    } else if (typeof (containerBinding as any).get === 'function') {
      // Try getting by name directly
      container = (containerBinding as any).get((containerBinding as any).idFromName(sessionId));
      console.log("[Worker] Got container via get");
    } else if (typeof (containerBinding as any).getByName === 'function') {
      container = (containerBinding as any).getByName(sessionId);
      console.log("[Worker] Got container via getByName");
    } else {
      console.error("[Worker] Container binding has no known methods:", Object.keys(containerBinding || {}));
      throw new Error("Cannot access container - no known methods");
    }
    
    console.log("[Worker] Container instance:", container);
    console.log("[Worker] Container has fetch?", typeof (container as any)?.fetch);
  } catch (error) {
    console.error("[Worker] Error getting container:", error);
    return c.text(`Container access error: ${error}`, 500);
  }

  const pair = new WebSocketPair() as { 0: WebSocket; 1: WebSocket & { accept(): void } };
  const client = pair[0];
  const server = pair[1];
  (server as any).accept();

  console.log("[Worker] WebSocket pair created, server accepted");

  // Connect to ttyd asynchronously
  (async () => {
    try {
      console.log("[Worker] Starting container connection...");
      const ttydWs = await Effect.runPromise(
        connectWebSocket(container as any, sessionId)
      );

      console.log("[Worker] Container WebSocket connected, accepting...");
      (ttydWs as any).accept();

      // Attach listeners BEFORE sending size message
      ttydWs.addEventListener("message", (event) => {
        console.log("[Worker] Received from ttyd:", {
          type: typeof event.data,
          length: event.data instanceof ArrayBuffer ? event.data.byteLength : event.data?.length,
        });
        if (server.readyState === WebSocket.OPEN) {
          server.send(event.data);
        }
      });

      server.addEventListener("message", (event: MessageEvent) => {
        console.log("[Worker] Received from client:", {
          type: typeof event.data,
          length: event.data instanceof ArrayBuffer ? event.data.byteLength : event.data?.length,
        });
        if (ttydWs.readyState === WebSocket.OPEN) {
          ttydWs.send(event.data);
        }
      });

      server.addEventListener("close", () => {
        console.log("[Worker] Client WebSocket closed");
        if (ttydWs.readyState === WebSocket.OPEN) {
          ttydWs.close();
        }
      });

      ttydWs.addEventListener("close", () => {
        console.log("[Worker] Container WebSocket closed");
        if (server.readyState === WebSocket.OPEN) {
          server.close();
        }
      });

      // Small delay to ensure listeners are attached
      await new Promise(resolve => setTimeout(resolve, 50));

      // Send terminal size to trigger bash prompt
      const sizeMsg = JSON.stringify({ columns: 80, rows: 24 });
      console.log("[Worker] Sending terminal size to ttyd:", sizeMsg);
      ttydWs.send(new TextEncoder().encode(sizeMsg));
    } catch (error) {
      console.error("[Worker] WebSocket connection error:", error);
      server.close(1011, String(error));
    }
  })();

  return new Response(null, {
    status: 101,
    webSocket: client,
  } as ResponseInit & { webSocket: WebSocket });
});

export default app;
