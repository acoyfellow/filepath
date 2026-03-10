/**
 * Worker support classes.
 * The Sandbox re-export is required by alchemy.run.ts Container binding.
 * SessionEventBusV2 acts as a thin session-scoped event bus for tree updates.
 */

import { Sandbox } from '@cloudflare/sandbox';
import { DurableObject } from 'cloudflare:workers';

// Re-export Sandbox for Container binding (alchemy.run.ts references it)
export { Sandbox };

export class SessionEventBusV2 extends DurableObject {
  private sockets = new Set<WebSocket>();

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();
      this.sockets.add(server);

      const cleanup = () => {
        this.sockets.delete(server);
      };

      server.addEventListener("close", cleanup);
      server.addEventListener("error", cleanup);

      console.log(`[SessionEventBusV2] Websocket connected (${this.sockets.size} open)`);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    if (request.method === "POST") {
      const payload = await request.text();
      for (const socket of this.sockets) {
        try {
          socket.send(payload);
        } catch {
          this.sockets.delete(socket);
        }
      }
      console.log(`[SessionEventBusV2] Broadcasted event to ${this.sockets.size} sockets`);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Method not allowed", { status: 405 });
  }
}
