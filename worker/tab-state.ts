import { DurableObject } from 'cloudflare:workers';

interface TabState {
  tabId: string;
  sessionId: string;
  name?: string;
  tmuxWindowIndex?: number;
  workingDir: string;
  history: string[];
  customEnvVars: Record<string, string>;
  createdAt: number;
  lastActivity: number;
}

export class TabStateDO extends DurableObject {
  private state: TabState | null = null;

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // GET /state - get current tab state
    if (request.method === 'GET' && path === '/state') {
      if (!this.state) {
        this.state = await this.ctx.storage.get<TabState>('state') || null;
      }
      return Response.json(this.state || {});
    }

    // POST /state - update tab state
    if (request.method === 'POST' && path === '/state') {
      const body = await request.json<Partial<TabState>>();

      if (!this.state) {
        this.state = await this.ctx.storage.get<TabState>('state') || {
          tabId: body.tabId!,
          sessionId: body.sessionId!,
          workingDir: '/root',
          history: [],
          customEnvVars: {},
          createdAt: Date.now(),
          lastActivity: Date.now(),
        };
      }

      // Update fields
      Object.assign(this.state, body);
      this.state.lastActivity = Date.now();

      // Persist
      await this.ctx.storage.put('state', this.state);

      return Response.json({ success: true });
    }

    // GET /dump - dump tab state for persistence/forking
    if (request.method === 'GET' && path === '/dump') {
      if (!this.state) {
        this.state = await this.ctx.storage.get<TabState>('state') || null;
      }
      return Response.json(this.state || {});
    }

    // POST /fork - create new tab with cloned state
    if (request.method === 'POST' && path === '/fork') {
      const body = await request.json<{ newTabId: string; newSessionId: string }>();

      if (!this.state) {
        return Response.json({ error: 'No state to fork' }, { status: 400 });
      }

      // Return cloned state for new tab
      const cloned: TabState = {
        ...this.state,
        tabId: body.newTabId,
        sessionId: body.newSessionId,
        createdAt: Date.now(),
        lastActivity: Date.now(),
      };

      return Response.json(cloned);
    }

    return new Response('Not found', { status: 404 });
  }
}
