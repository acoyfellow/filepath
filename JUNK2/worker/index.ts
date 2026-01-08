import { Hono } from "hono";
import { html } from "hono/html";
import { getSandbox, proxyToSandbox } from "@cloudflare/sandbox";
import { getContainer } from "@cloudflare/containers";

// Export Sandbox class so Alchemy can use it
export { Sandbox } from "@cloudflare/sandbox";

// Cloudflare Workers WebSocket types
declare const WebSocketPair: {
  new(): { 0: WebSocket; 1: WebSocket };
};
import { createSession, getSession, verifyPassword } from "./sessions";

// Using @cloudflare/sandbox instead of Container class - this is what was working

type Env = {
  Sandbox: any; // Alchemy Container binding - will be DurableObjectNamespace at runtime
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

  // For now, just return success - we'll add ttyd later once hello world works
  return c.json({ success: true, message: "Hello world mode - ttyd coming soon" });
});

// TEST: Simple hello world - verify container works
app.get("/test/container", async (c) => {
  const containerBinding = c.env.Sandbox;

  try {
    const sandbox = getSandbox(containerBinding as any, "test");
    console.log("[Test] Got sandbox instance");

    // sandbox.fetch() calls containerFetch() which auto-starts container
    // But it determines port from URL path: /proxy/{port} or defaults to 3000
    // So we need to use /proxy/8080 in the path
    const testUrl = new URL(c.req.url);
    testUrl.pathname = "/proxy/8080/";

    const testRequest = new Request(testUrl.toString(), {
      method: "GET",
    });

    console.log("[Test] Calling sandbox.fetch() with /proxy/8080 - this will auto-start container...");

    const startTime = Date.now();
    const response = await sandbox.fetch(testRequest);
    const elapsed = Date.now() - startTime;

    console.log("[Test] Fetch completed in", elapsed, "ms");
    console.log("[Test] Response status:", response.status);
    const text = await response.text();

    return c.json({
      status: response.status,
      statusText: response.statusText,
      body: text,
      elapsed,
    });
  } catch (error) {
    console.error("[Test] Container connection error:", error);
    return c.json({
      error: String(error),
      message: "Container connection failed",
      stack: error instanceof Error ? error.stack : undefined,
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

  // Use getSandbox - this is what was working in production
  const sandbox = getSandbox(containerBinding as any, sessionId);
  console.log("[Worker] Got sandbox for session:", sessionId);

  const pair = new WebSocketPair() as { 0: WebSocket; 1: WebSocket & { accept(): void } };
  const client = pair[0];
  const server = pair[1];
  (server as any).accept();

  console.log("[Worker] WebSocket pair created, server accepted");

  // Connect to ttyd asynchronously - using sandbox.wsConnect like the working version
  (async () => {
    try {
      console.log("[Worker] Starting ttyd connection...");

      // Rewrite URL to /ws for ttyd (like the working version)
      const originalUrl = new URL(c.req.url);
      const ttydUrl = new URL("/ws", originalUrl.origin);
      const wsRequest = new Request(ttydUrl.toString(), {
        method: c.req.raw.method,
        headers: c.req.raw.headers,
      });

      console.log("[Worker] Calling sandbox.wsConnect to port 7681...");
      const ttydResponse = await sandbox.wsConnect(wsRequest, 7681) as Response & { webSocket?: WebSocket };

      if (ttydResponse.status !== 101 || !ttydResponse.webSocket) {
        console.error("[Worker] ttyd connection failed:", ttydResponse.status);
        server.close(1011, "Failed to connect to ttyd");
        return;
      }

      const ttydWs = ttydResponse.webSocket;
      console.log("[Worker] ttyd WebSocket received, accepting...");
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

      // Small delay to ensure listeners are attached and ttyd is ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // ttyd protocol: Send terminal size as JSON immediately after connection
      // Format: {"columns": number, "rows": number}
      // This triggers ttyd to send the initial bash prompt
      // ttyd expects this as a TEXT message (JSON string), not binary
      const sizeMsg = JSON.stringify({ columns: 80, rows: 24 });
      console.log("[Worker] Sending terminal size to ttyd (text):", sizeMsg);
      ttydWs.send(sizeMsg);
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
