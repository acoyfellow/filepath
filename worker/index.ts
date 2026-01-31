import { DurableObject } from 'cloudflare:workers'
import { getSandbox, Sandbox } from '@cloudflare/sandbox'

// Re-export Sandbox for Container binding
export { Sandbox }

// Track active terminals
const activeTerminals = new Set<string>();

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

      // Handle terminal start: /terminal/{terminalId}/start
      if (pathname.match(/^\/terminal\/[^/]+\/start$/) && request.method === 'POST') {
        const terminalId = pathname.split('/')[2];
        
        if (activeTerminals.has(terminalId)) {
          return Response.json({ success: true, terminalId, reused: true });
        }
        
        try {
          const sandbox = getSandbox(env.Sandbox, terminalId);
          await sandbox.startProcess('ttyd -W -p 7681 opencode');
          activeTerminals.add(terminalId);
          
          return Response.json({ success: true, terminalId });
        } catch (error) {
          console.error('[terminal/start]', error);
          return Response.json(
            { error: 'Failed to start terminal', message: String(error) },
            { status: 500 }
          );
        }
      }

      // Handle terminal proxy: /terminal/{terminalId}/proxy/*
      if (pathname.match(/^\/terminal\/[^/]+\/proxy/)) {
        const parts = pathname.split('/');
        const terminalId = parts[2];
        const proxyPath = '/' + parts.slice(4).join('/') || '/';
        
        try {
          const sandbox = getSandbox(env.Sandbox, terminalId);
          const ttydUrl = `http://localhost:7681${proxyPath}${url.search}`;
          
          // Handle WebSocket upgrade
          if (request.headers.get('Upgrade') === 'websocket') {
            return sandbox.fetch(new Request(ttydUrl, { headers: request.headers }));
          }
          
          return sandbox.fetch(new Request(ttydUrl));
        } catch (error) {
          console.error('[terminal/proxy]', error);
          return new Response('Terminal not available', { status: 502 });
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
