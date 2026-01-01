import { DurableObject } from 'cloudflare:workers';
import type { PasswordHash } from './types';
import { hashPassword } from './password';

// SessionState Durable Object - manages tab state and WebSocket connections for a session
export class SessionStateDO extends DurableObject {
  private wsConnections: Set<WebSocket> = new Set();
  private tabs: Array<{ id: string; name: string }> = [];
  private activeTab: string | null = null;
  private agents: string[] = [];
  private createdAt: number | null = null;
  private lastActivity: number | null = null;
  private passwordHash: PasswordHash | null = null;

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle WebSocket upgrade for tab state sync
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    // GET /tabs - get current tab state
    if (request.method === 'GET' && path === '/tabs') {
      // Load from storage if not in memory
      if (this.tabs.length === 0) {
        const stored = await this.ctx.storage.get<Array<{ id: string; name: string }>>('tabs');
        if (stored) this.tabs = stored;
        this.activeTab = await this.ctx.storage.get<string>('activeTab') || null;
      }
      if (!this.createdAt) {
        this.createdAt = await this.ctx.storage.get<number>('createdAt') || Date.now();
        if (!(await this.ctx.storage.get<number>('createdAt'))) {
          await this.ctx.storage.put('createdAt', this.createdAt);
        }
      }
      if (this.agents.length === 0) {
        this.agents = await this.ctx.storage.get<string[]>('agents') || [];
      }
      return Response.json({
        tabs: this.tabs,
        activeTab: this.activeTab,
        createdAt: this.createdAt,
        agents: this.agents
      });
    }

    // POST /tabs - update tab state
    if (request.method === 'POST' && path === '/tabs') {
      const body = await request.json<{ tabs: Array<{ id: string; name: string }>; activeTab?: string }>();
      if (!body.tabs || !Array.isArray(body.tabs)) {
        return Response.json({ error: 'Invalid body: expected { tabs: Array<{id, name}> }' }, { status: 400 });
      }

      this.tabs = body.tabs;
      if (body.activeTab !== undefined) {
        this.activeTab = body.activeTab;
      }

      // Update last activity (tab changes indicate activity)
      this.lastActivity = Date.now();
      await this.ctx.storage.put('lastActivity', this.lastActivity);

      // Persist to storage
      await this.ctx.storage.put('tabs', this.tabs);
      if (this.activeTab) {
        await this.ctx.storage.put('activeTab', this.activeTab);
      }

      // Broadcast to all connected WebSockets
      this.broadcast({ tabs: this.tabs, activeTab: this.activeTab });

      return Response.json({ success: true });
    }

    // POST /agents - set agents for this session (alternative to URL params)
    if (request.method === 'POST' && path === '/agents') {
      const body = await request.json<{ agents: string[] }>();
      if (!body.agents || !Array.isArray(body.agents)) {
        return Response.json({ error: 'Invalid body: expected { agents: string[] }' }, { status: 400 });
      }
      this.agents = body.agents;
      await this.ctx.storage.put('agents', this.agents);
      const now = Date.now();
      if (!this.createdAt) {
        this.createdAt = now;
        await this.ctx.storage.put('createdAt', this.createdAt);
      }
      this.lastActivity = now;
      await this.ctx.storage.put('lastActivity', this.lastActivity);
      return Response.json({ success: true });
    }

    // POST /set-password - set or update password
    if (request.method === 'POST' && path === '/set-password') {
      const body = await request.json<{ password: string }>();
      if (!body.password || typeof body.password !== 'string') {
        return Response.json({ error: 'Invalid body: expected { password: string }' }, { status: 400 });
      }
      this.passwordHash = await hashPassword(body.password);
      await this.ctx.storage.put('passwordHash', this.passwordHash);
      return Response.json({ success: true });
    }

    // POST /verify-password - verify password
    if (request.method === 'POST' && path === '/verify-password') {
      const body = await request.json<{ password: string }>();
      if (!body.password || typeof body.password !== 'string') {
        return Response.json({ error: 'Invalid body: expected { password: string }' }, { status: 400 });
      }
      if (this.passwordHash === null) {
        this.passwordHash = await this.ctx.storage.get<PasswordHash>('passwordHash') || null;
      }
      if (!this.passwordHash) {
        return Response.json({ error: 'No password set' }, { status: 400 });
      }
      const { verifyPassword } = await import('./password');
      const isValid = await verifyPassword(body.password, this.passwordHash);
      if (!isValid) {
        return Response.json({ error: 'Invalid password' }, { status: 401 });
      }
      return Response.json({ success: true });
    }

    // GET /info - get session info (age, agents, etc.)
    if (request.method === 'GET' && path === '/info') {
      if (!this.createdAt) {
        this.createdAt = await this.ctx.storage.get<number>('createdAt') || Date.now();
        if (!(await this.ctx.storage.get<number>('createdAt'))) {
          await this.ctx.storage.put('createdAt', this.createdAt);
        }
      }
      if (!this.lastActivity) {
        this.lastActivity = await this.ctx.storage.get<number>('lastActivity') || this.createdAt;
        if (!(await this.ctx.storage.get<number>('lastActivity'))) {
          await this.ctx.storage.put('lastActivity', this.lastActivity);
        }
      }
      if (this.agents.length === 0) {
        this.agents = await this.ctx.storage.get<string[]>('agents') || [];
      }
      if (this.passwordHash === null) {
        this.passwordHash = await this.ctx.storage.get<PasswordHash>('passwordHash') || null;
      }

      // Update last activity on any request (indicates session is active)
      const now = Date.now();
      this.lastActivity = now;
      await this.ctx.storage.put('lastActivity', this.lastActivity);

      const age = now - this.createdAt;
      const ttl = 10 * 60 * 1000; // 10 minutes default (sandbox sleepAfter)
      // Calculate time until sleep based on last activity, not creation time
      const timeSinceActivity = now - this.lastActivity;
      const timeUntilSleep = Math.max(0, ttl - timeSinceActivity);

      return Response.json({
        sessionId: '', // Will be set by caller
        createdAt: this.createdAt,
        lastActivity: this.lastActivity,
        age,
        ttl,
        timeUntilSleep,
        agents: this.agents,
        hasPassword: this.passwordHash !== null
      });
    }

    return new Response('Not found', { status: 404 });
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();
    this.wsConnections.add(server);

    // Load and send current state
    if (this.tabs.length === 0) {
      const stored = await this.ctx.storage.get<Array<{ id: string; name: string }>>('tabs');
      if (stored) this.tabs = stored;
      this.activeTab = await this.ctx.storage.get<string>('activeTab') || null;
    }
    if (!this.createdAt) {
      this.createdAt = await this.ctx.storage.get<number>('createdAt') || Date.now();
      if (!(await this.ctx.storage.get<number>('createdAt'))) {
        await this.ctx.storage.put('createdAt', this.createdAt);
      }
    }
    if (!this.lastActivity) {
      this.lastActivity = await this.ctx.storage.get<number>('lastActivity') || this.createdAt;
      if (!(await this.ctx.storage.get<number>('lastActivity'))) {
        await this.ctx.storage.put('lastActivity', this.lastActivity);
      }
    }
    if (this.agents.length === 0) {
      this.agents = await this.ctx.storage.get<string[]>('agents') || [];
    }

    // Update last activity on WebSocket connection (indicates activity)
    const now = Date.now();
    this.lastActivity = now;
    await this.ctx.storage.put('lastActivity', this.lastActivity);

    server.send(JSON.stringify({
      tabs: this.tabs,
      activeTab: this.activeTab,
      createdAt: this.createdAt,
      lastActivity: this.lastActivity,
      agents: this.agents
    }));

    // Clean up on close
    server.addEventListener('close', () => {
      this.wsConnections.delete(server);
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private broadcast(message: { tabs: Array<{ id: string; name: string }>; activeTab: string | null; createdAt?: number; agents?: string[] }) {
    const data = JSON.stringify(message);
    for (const ws of this.wsConnections) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(data);
        } catch (err) {
          // Remove dead connections
          this.wsConnections.delete(ws);
        }
      }
    }
  }
}

