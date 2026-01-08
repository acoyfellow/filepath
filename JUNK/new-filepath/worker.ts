import { getSandbox, proxyToSandbox } from "@cloudflare/sandbox";

// Cloudflare Workers WebSocket types
declare const WebSocketPair: {
  new(): { 0: WebSocket; 1: WebSocket };
};

const sessions = new Map<string, { ready: boolean; url?: string }>();

export default {
  async fetch(request: Request, env: { Sandbox: any }) {
    const proxy = await proxyToSandbox(request, env);
    if (proxy) return proxy;

    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "POST" && path === "/session") {
      const id = crypto.randomUUID().slice(0, 8);
      sessions.set(id, { ready: false });
      return new Response(JSON.stringify({ sessionId: id }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Session info endpoint
    if (request.method === "GET" && path.startsWith("/session/") && path.endsWith("/info")) {
      const id = path.split("/")[2];
      return new Response(JSON.stringify({
        createdAt: Date.now(),
        age: 0,
        ttl: 3600000,
        timeUntilSleep: 3600000,
        hasPassword: false
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Tabs endpoint
    if (path.startsWith("/session/") && path.endsWith("/tabs")) {
      const id = path.split("/")[2];
      if (request.method === "GET") {
        return new Response(JSON.stringify({ tabs: [], activeTab: null }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      if (request.method === "POST") {
        // Just acknowledge, don't store
        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // Tab WebSocket endpoint (stub - returns 404 for now)
    if (path.startsWith("/session/") && path.endsWith("/tabs/ws")) {
      return new Response("WebSocket not implemented", { status: 404 });
    }

    // Terminal tab start endpoint
    if (request.method === "POST" && path.startsWith("/terminal/") && path.endsWith("/start")) {
      // Path format: /terminal/:sessionId/:tabId/start
      const parts = path.split("/");
      const sessionId = parts[2];
      const tabId = parts[3];
      const sandboxId = `${sessionId}:${tabId}`;
      const { hostname } = url;

      const sandbox = getSandbox(env.Sandbox, sandboxId);

      try {
        await sandbox.exec("pkill -f ttyd || true");
        const ttyd = await sandbox.startProcess("ttyd -W -p 7681 bash");
        await ttyd.waitForPort(7681, { mode: "tcp", timeout: 30000 });

        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // Terminal tab WebSocket endpoint
    if (path.startsWith("/terminal/") && path.endsWith("/ws") && request.headers.get("Upgrade") === "websocket") {
      // Path format: /terminal/:sessionId/:tabId/ws
      const parts = path.split("/");
      const sessionId = parts[2];
      const tabId = parts[3];
      const sandboxId = `${sessionId}:${tabId}`;

      const pair = new WebSocketPair() as { 0: WebSocket; 1: WebSocket & { accept(): void } };
      const client = pair[0];
      const server = pair[1];
      (server as any).accept();

      // Connect to ttyd asynchronously
      (async () => {
        try {
          const sandbox = getSandbox(env.Sandbox, sandboxId);

          // Rewrite URL to /ws for ttyd
          const ttydUrl = new URL("/ws", url.origin);
          const wsRequest = new Request(ttydUrl.toString(), {
            method: request.method,
            headers: request.headers,
          });

          const ttydResponse = await sandbox.wsConnect(wsRequest, 7681) as Response & { webSocket?: WebSocket };

          if (ttydResponse.status !== 101 || !ttydResponse.webSocket) {
            server.close(1011, "Failed to connect to ttyd");
            return;
          }

          const ttyd = ttydResponse.webSocket;
          (ttyd as any).accept();

          // CRITICAL: Attach event listener BEFORE sending terminal size
          // ttyd may send initial prompt immediately, so we need to be ready
          ttyd.addEventListener("message", (event) => {
            console.log("[Worker] Received from ttyd:", {
              dataType: typeof event.data,
              dataLength: event.data instanceof ArrayBuffer ? event.data.byteLength : event.data?.length,
            });
            if (server.readyState === WebSocket.OPEN) {
              server.send(event.data);
            }
          });

          // Forward messages: client -> ttyd
          server.addEventListener("message", (event) => {
            if (ttyd.readyState === WebSocket.OPEN) {
              ttyd.send(event.data);
            }
          });

          // Small delay to ensure listener is fully attached
          await new Promise(resolve => setTimeout(resolve, 50));

          // Send terminal size to trigger bash prompt
          const sizeMsg = JSON.stringify({ columns: 80, rows: 24 });
          console.log("[Worker] Sending terminal size to ttyd:", sizeMsg);
          ttyd.send(new TextEncoder().encode(sizeMsg));

          // Cleanup on close
          server.addEventListener("close", () => {
            if (ttyd.readyState === WebSocket.OPEN) {
              ttyd.close();
            }
          });

          ttyd.addEventListener("close", () => {
            if (server.readyState === WebSocket.OPEN) {
              server.close();
            }
          });
        } catch (error) {
          console.error("WebSocket error:", error);
          server.close(1011, String(error));
        }
      })();

      return new Response(null, {
        status: 101,
        webSocket: client
      } as ResponseInit & { webSocket: WebSocket });
    }

    if (request.method === "POST" && path.startsWith("/simple/")) {
      const id = path.split("/")[2];
      const { hostname } = url;

      const existing = sessions.get(id);
      if (existing?.ready && existing.url) {
        return new Response(JSON.stringify({ ready: true, url: existing.url }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      const sandbox = getSandbox(env.Sandbox, id);

      try {
        await sandbox.exec("pkill -f ttyd || true");
        const ttyd = await sandbox.startProcess("ttyd -p 7681 bash");
        await ttyd.waitForPort(7681, { mode: "tcp", timeout: 30000 });

        const exposed = await sandbox.exposePort(7681, { hostname }) as { url: string };
        const previewUrl = exposed.url;

        sessions.set(id, { ready: true, url: previewUrl });

        return new Response(JSON.stringify({ ready: true, url: previewUrl }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    return new Response("Not found", { status: 404 });
  }
};
