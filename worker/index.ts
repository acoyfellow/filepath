import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getSandbox, Sandbox as SandboxDO } from '@cloudflare/sandbox';
import { SessionStateDO } from './session-state';
import { TabStateDO } from './tab-state';
import type { CreateSessionRequest, SessionId, SessionInfo } from './types';

export { SandboxDO as Sandbox, SessionStateDO, TabStateDO };

type Env = {
  Sandbox: DurableObjectNamespace<SandboxDO>;
  SessionState: DurableObjectNamespace;
  TabState: DurableObjectNamespace<TabStateDO>;
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  CURSOR_API_KEY: string;
  FACTORY_API_KEY: string;
};

const app = new Hono<{ Bindings: Env }>();

// CORS for local dev
app.use('*', cors({ origin: '*' }));

// Password validation middleware
async function requirePassword(c: any, next: () => Promise<Response>) {
  // Skip WebSocket upgrades - they handle password via query params in the route handler
  if (c.req.header('Upgrade') === 'websocket') {
    return next();
  }
  
  const sessionId = c.req.param('id') || c.req.param('sessionId');
  if (!sessionId) return next();
  
  const sessionState = getSessionState(c.env, sessionId);
  const infoRes = await sessionState.fetch(new Request('http://do/info'));
  if (!infoRes.ok) return next();
  
  const info = await infoRes.json() as SessionInfo;
  if (!info.hasPassword) return next();  // No password required
  
  // Check for password (header for HTTP)
  const password = c.req.header('X-Session-Password');
  if (!password) {
    return c.json({ error: 'Password required', hasPassword: true }, 401);
  }
  
  // Verify password via DO endpoint
  const verifyRes = await sessionState.fetch(new Request('http://do/verify-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  }));
  if (!verifyRes.ok) {
    return c.json({ error: 'Invalid password' }, 401);
  }
  
  return next();
}

// In-memory storage for session agents (in production, use Durable Object storage)
const sessionAgents = new Map<string, string[]>();

// Helper to get SessionState DO for a session
function getSessionState(env: Env, sessionId: string) {
  const id = env.SessionState.idFromName(sessionId);
  return env.SessionState.get(id);
}

// Helper to get TabState DO for a specific tab
function getTabState(env: Env, sessionId: string, tabId: string) {
  const id = env.TabState.idFromName(`${sessionId}:${tabId}`);
  return env.TabState.get(id);
}

// Create session - store agents in SessionStateDO instead of URL params
app.post('/session', async (c) => {
  try {
    const { agents, sessionId, password } = await c.req.json<CreateSessionRequest>();

    if (!agents || !Array.isArray(agents) || agents.length === 0) {
      return c.json({ error: 'At least one agent must be selected' }, 400);
    }

    // Generate or use provided sessionId
    const finalSessionId = (sessionId || crypto.randomUUID().slice(0, 8)) as SessionId;

    // Check if session exists
    const sessionState = getSessionState(c.env, finalSessionId);
    const infoRes = await sessionState.fetch(new Request('http://do/info'));
    const exists = infoRes.ok;

    if (exists) {
      // Session exists - verify password if session has one
      const info = await infoRes.json() as SessionInfo;
      if (info.hasPassword) {
        if (!password) {
          return c.json({ error: 'Password required', hasPassword: true }, 401);
        }
        // Verify password via DO endpoint
        const verifyRes = await sessionState.fetch(new Request('http://do/verify-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        }));
        if (!verifyRes.ok) {
          return c.json({ error: 'Invalid password' }, 401);
        }
      }
    }

    // Store agents in SessionStateDO (persistent, shared across browsers)
    await sessionState.fetch(new Request('http://do/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agents }),
    }));

    // Set password if provided
    if (password) {
      await sessionState.fetch(new Request('http://do/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      }));
    }

    // Also keep in-memory for backward compatibility
    sessionAgents.set(finalSessionId, agents);

    return c.json({ sessionId: finalSessionId });
  } catch (error) {
    console.error('Session creation error:', error);
    return c.json({
      error: 'Failed to create session',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Track started sessions to avoid duplicate ttyd starts
const startedSessions = new Set<string>();
const startingSessions = new Map<string, Promise<void>>();
// Track tmux windows for each tab (tabKey -> window index)
const tabWindows = new Map<string, number>();
let nextWindowIndex = 0;
// Track ttyd startup promises per session to prevent race conditions
const ttydStartPromises = new Map<string, Promise<void>>();

async function ensureCmd(
  sandbox: ReturnType<typeof getSandbox>,
  name: string,
  installCmd: string
) {
  const check = await sandbox.exec(`bash -lc "command -v ${name} >/dev/null 2>&1"`);
  if (check.exitCode === 0) return;

  const install = await sandbox.exec(`bash -lc "${installCmd.replaceAll('"', '\\"')}"`);
  if (!install.success) {
    throw new Error(
      `Failed to install ${name}. exitCode=${install.exitCode}\nstdout:\n${install.stdout}\nstderr:\n${install.stderr}`
    );
  }

  // For opencode, the install script modifies .bashrc - trust successful install
  // The terminal sources .bashrc on startup, so opencode will be available there
  if (name === 'opencode' && install.success) {
    // Strip ANSI escape codes before matching
    const stdout = install.stdout.replace(/\x1b\[[0-9;]*m/g, '');
    console.log('opencode install stdout (stripped):', stdout.substring(0, 200));
    if (
      stdout.includes('Successfully added') ||
      stdout.includes('$PATH') ||
      stdout.includes('Command already exists') ||
      stdout.includes('opencode version')
    ) {
      console.log('opencode install succeeded, skipping verification');
      return;
    }
  }

  const check2 = await sandbox.exec(`bash -lc "command -v ${name} >/dev/null 2>&1"`);
  if (check2.exitCode !== 0) {
    throw new Error(
      `${name} still not found after install.\ninstall stdout:\n${install.stdout}\ninstall stderr:\n${install.stderr}`
    );
  }
}

// Apply password middleware to protected routes (skip WebSocket upgrades)
app.use('/terminal/:id/start', requirePassword);
app.use('/terminal/:sessionId/:tabId/ws', requirePassword);
app.use('/session/:id/info', requirePassword);
app.use('/session/:id/tabs', requirePassword);
// Note: /session/:id/tabs/ws is handled separately below (WebSocket upgrade)

// Start terminal session (with optional tabId)
app.post('/terminal/:id/start', async (c) => {
  const sessionId = c.req.param('id');
  console.log('Starting terminal for session:', sessionId);

  // Skip if already started
  if (startedSessions.has(sessionId)) {
    return c.json({ ready: true, port: 7681 });
  }
  const inflight = startingSessions.get(sessionId);
  if (inflight) {
    await inflight;
    return c.json({ ready: true, port: 7681 });
  }

  const sandbox = getSandbox(c.env.Sandbox, sessionId);

  try {
    const startPromise = (async () => {
      let agents = sessionAgents.get(sessionId) || [];
      const contentLength = c.req.header("Content-Length");
      const contentType = c.req.header("Content-Type") ?? "";
      const hasBody = contentLength ? Number(contentLength) > 0 : false;
      if (hasBody || contentType.includes("application/json")) {
        const body = await c.req.json<{ agents?: string[] }>();
        if (!body?.agents || !Array.isArray(body.agents)) {
          throw new Error("Invalid body: expected { agents: string[] }");
        }
        agents = body.agents.filter((x) => typeof x === "string");
        sessionAgents.set(sessionId, agents);
      }
      console.log("c.env", c.env);

      const envVars: Record<string, string> = {
        // Include common CLI install locations
        PATH: '/root/.bun/bin:/root/.cursor/bin:/root/.factory/bin:/root/.local/bin:/usr/local/bin:/usr/bin:/bin',
      };
      console.log(
        "envVars",
        {
          ...envVars,
          ANTHROPIC_API_KEY: c.env.ANTHROPIC_API_KEY ? `len=${c.env.ANTHROPIC_API_KEY.length}` : undefined,
          OPENAI_API_KEY: c.env.OPENAI_API_KEY ? `len=${c.env.OPENAI_API_KEY.length}` : undefined,
        }
      );
      // If claude is selected, require API key so Claude Code can skip interactive auth
      if (agents.includes('claude') && !c.env.ANTHROPIC_API_KEY) {
        throw new Error('Missing ANTHROPIC_API_KEY (required when claude agent is selected)');
      }
      if (c.env.ANTHROPIC_API_KEY) envVars.ANTHROPIC_API_KEY = c.env.ANTHROPIC_API_KEY;
      if (c.env.OPENAI_API_KEY) envVars.OPENAI_API_KEY = c.env.OPENAI_API_KEY;
      if (c.env.CURSOR_API_KEY) envVars.CURSOR_API_KEY = c.env.CURSOR_API_KEY;
      if (c.env.FACTORY_API_KEY) envVars.FACTORY_API_KEY = c.env.FACTORY_API_KEY;
      await sandbox.setEnvVars(envVars);

      // Install agents (block until installed so terminal is usable immediately)
      if (agents.includes('claude')) {
        await ensureCmd(sandbox, 'claude', 'bun add -g @anthropic-ai/claude-code');
      }
      if (agents.includes('codex')) {
        await ensureCmd(sandbox, 'codex', 'bun add -g @openai/codex');
      }
      if (agents.includes('cursor')) {
        // Cursor installs to ~/.cursor/bin, ensure PATH includes it
        await ensureCmd(sandbox, 'cursor-agent', 'curl -fsS https://cursor.com/install | bash');
      }
      if (agents.includes('opencode')) {
        // OpenCode installs via curl script
        await ensureCmd(sandbox, 'opencode', 'curl -fsSL https://opencode.ai/install | bash');
      }
      if (agents.includes('droid')) {
        // Factory Droid installs via curl script
        await ensureCmd(sandbox, 'droid', 'curl -fsSL https://app.factory.ai/cli | sh');
      }

      // Main session initialization: install agents and set env vars
      // Each tab will start its own ttyd instance, so we don't start one here
      // Just mark the session as initialized
      startedSessions.add(sessionId);
    })();

    startingSessions.set(sessionId, startPromise);
    await startPromise;
    startingSessions.delete(sessionId);
    return c.json({ ready: true, port: 7681 });
  } catch (error) {
    startingSessions.delete(sessionId);
    console.error('Terminal start error:', error);
    if (error instanceof Error && error.message.startsWith("Invalid body:")) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: String(error) }, 500);
  }
});

// Start terminal tab (new endpoint with tabId)
// Uses a single ttyd instance with tmux windows (Cloudflare Sandbox only exposes port 7681)
app.post('/terminal/:sessionId/:tabId/start', async (c) => {
  const sessionId = c.req.param('sessionId');
  const tabId = c.req.param('tabId');
  console.log('Starting terminal tab for session:', sessionId, 'tab:', tabId);

  const tabKey = `${sessionId}:${tabId}`;

  // Skip if this specific tab is already started
  if (startedSessions.has(tabKey)) {
    // Return stored window index
    const tabState = getTabState(c.env, sessionId, tabId);
    const stateRes = await tabState.fetch(new Request('http://do/state'));
    const state = await stateRes.json();
    return c.json({ ready: true, port: 7681, windowIndex: state.tmuxWindowIndex });
  }
  const inflight = startingSessions.get(tabKey);
  if (inflight) {
    await inflight;
    // Return stored window index
    const tabState = getTabState(c.env, sessionId, tabId);
    const stateRes = await tabState.fetch(new Request('http://do/state'));
    const state = await stateRes.json();
    return c.json({ ready: true, port: 7681, windowIndex: state.tmuxWindowIndex });
  }

  const sandbox = getSandbox(c.env.Sandbox, sessionId);

  try {
    const startPromise = (async () => {
      // Ensure main session is initialized (agents installed, env vars set)
      if (!startedSessions.has(sessionId)) {
        const mainInflight = startingSessions.get(sessionId);
        if (mainInflight) {
          await mainInflight;
        } else {
          throw new Error('Main session must be initialized first. Call /terminal/:id/start before starting tabs.');
        }
      }

      // Start single ttyd instance for the session if not already started
      // Use tmux so all WebSocket connections share the same terminal session
      const ttydKey = `${sessionId}:ttyd`;
      if (!startedSessions.has(ttydKey)) {
        let ttydStartPromise = ttydStartPromises.get(sessionId);
        if (!ttydStartPromise) {
          ttydStartPromise = (async () => {
            // Create a detached tmux session first
            await sandbox.exec('tmux new-session -d -s shared');
            // Start ttyd attached to the tmux session
            // All WebSocket connections will share this same tmux session
            const ttyd = await sandbox.startProcess(
              `ttyd -W -p 7681 tmux attach-session -t shared`
            );
            await ttyd.waitForPort(7681, { mode: 'tcp', timeout: 20000 });
            startedSessions.add(ttydKey);
            ttydStartPromises.delete(sessionId);
          })();
          ttydStartPromises.set(sessionId, ttydStartPromise);
        }
        await ttydStartPromise;
      }

      // Allocate window index
      // Query all existing tabs in this session to find max window index
      const sessionState = getSessionState(c.env, sessionId);
      const tabsRes = await sessionState.fetch(new Request('http://do/tabs'));
      // ALL tabs in a session share the same tmux window (window 0)
      // This ensures terminal output and history are synced across all tabs/browsers
      const windowIndex = 0;

      // NOTE: Window will be created by frontend via WebSocket tmux command
      // (sandbox.exec runs in different context and can't access tmux socket)
      console.log(`Allocated tmux window ${windowIndex} for tab ${tabId}`);

      // Store in TabStateDO
      const tabState = getTabState(c.env, sessionId, tabId);
      await tabState.fetch(new Request('http://do/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tabId,
          sessionId,
          tmuxWindowIndex: windowIndex,
          workingDir: '/root',
          history: [],
          customEnvVars: {},
          createdAt: Date.now(),
          lastActivity: Date.now(),
        }),
      }));

      startedSessions.add(tabKey);
    })();

    startingSessions.set(tabKey, startPromise);
    await startPromise;
    startingSessions.delete(tabKey);

    // Get the window index from TabStateDO to return it
    const tabState = getTabState(c.env, sessionId, tabId);
    const stateRes = await tabState.fetch(new Request('http://do/state'));
    const state = await stateRes.json() as { tmuxWindowIndex?: number };

    return c.json({ ready: true, port: 7681, windowIndex: state.tmuxWindowIndex });
  } catch (error) {
    startingSessions.delete(tabKey);
    console.error('Terminal tab start error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// WebSocket terminal connection - legacy endpoint for backwards compatibility
// New tabs should use /terminal/:sessionId/:tabId/ws
app.get('/terminal/:id/ws', async (c) => {
  const upgrade = c.req.header('Upgrade');
  if (upgrade?.toLowerCase() !== 'websocket') {
    return c.text('Expected WebSocket upgrade', 400);
  }

  const sessionId = c.req.param('id');
  console.log('WS connecting to sandbox for session:', sessionId);
  console.log('WS subprotocol header:', c.req.header('Sec-WebSocket-Protocol'));
  const sandbox = getSandbox(c.env.Sandbox, sessionId);

  try {
    // For legacy compatibility, use port 7681 (first tab's port)
    // In practice, tabs should use the tab-specific endpoint
    const originalUrl = new URL(c.req.url);
    const ttydUrl = new URL('/ws' + originalUrl.search, originalUrl.origin);
    const wsRequest = new Request(ttydUrl.toString(), {
      method: c.req.raw.method,
      headers: c.req.raw.headers,
    });

    console.log('Calling wsConnect with URL:', ttydUrl.toString());
    const response = await sandbox.wsConnect(wsRequest, 7681);
    console.log('wsConnect response status:', response.status);
    return response;
  } catch (error) {
    console.error('WebSocket connection error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// WebSocket terminal connection for specific tab
// All tabs use the same ttyd instance on port 7681, but connect to different tmux windows
app.get('/terminal/:sessionId/:tabId/ws', async (c) => {
  const upgrade = c.req.header('Upgrade');
  if (upgrade?.toLowerCase() !== 'websocket') {
    return c.text('Expected WebSocket upgrade', 400);
  }

  const sessionId = c.req.param('sessionId');
  const tabId = c.req.param('tabId');
  console.log('WS connecting to sandbox for session:', sessionId, 'tab:', tabId);
  console.log('WS subprotocol header:', c.req.header('Sec-WebSocket-Protocol'));
  const sandbox = getSandbox(c.env.Sandbox, sessionId);

  try {
    // All tabs use port 7681 (single ttyd instance)
    const port = 7681;
    const tabKey = `${sessionId}:${tabId}`;

    // Ensure the tab's tmux window exists
    if (!startedSessions.has(tabKey)) {
      // Tab window should have been created by /start endpoint, but handle race condition
      const windowIndex = tabWindows.get(tabKey);
      if (windowIndex === undefined) {
        return c.json({ error: 'Tab not initialized. Call /start first.' }, 400);
      }
    }

    // Rewrite URL to just /ws for ttyd
    const originalUrl = new URL(c.req.url);
    const ttydUrl = new URL('/ws' + originalUrl.search, originalUrl.origin);
    const wsRequest = new Request(ttydUrl.toString(), {
      method: c.req.raw.method,
      headers: c.req.raw.headers,
    });

    console.log('Calling wsConnect with URL:', ttydUrl.toString(), 'port:', port);
    const response = await sandbox.wsConnect(wsRequest, port);
    console.log('wsConnect response status:', response.status);
    return response;
  } catch (error) {
    console.error('WebSocket connection error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Get session tab state
app.get('/session/:id/tabs', async (c) => {
  const sessionId = c.req.param('id');
  const sessionState = getSessionState(c.env, sessionId);
  // Forward to DO with just /tabs path
  return sessionState.fetch(new Request(new URL('/tabs', c.req.url).toString(), {
    method: 'GET',
    headers: c.req.raw.headers,
  }));
});

// Get session info (age, TTL, agents)
app.get('/session/:id/info', async (c) => {
  const sessionId = c.req.param('id');
  const sessionState = getSessionState(c.env, sessionId);
  const res = await sessionState.fetch(new Request('http://do/info'));
  if (!res.ok) return res;
  const info = await res.json() as SessionInfo;
  return c.json({ ...info, sessionId: sessionId as SessionId });
});

// Update session tab state
app.post('/session/:id/tabs', async (c) => {
  const sessionId = c.req.param('id');
  const sessionState = getSessionState(c.env, sessionId);
  const body = await c.req.text();
  // Forward to DO with just /tabs path
  return sessionState.fetch(new Request('http://do/tabs', {
    method: 'POST',
    headers: c.req.raw.headers,
    body,
  }));
});

// WebSocket for tab state sync - delegates to SessionState DO
app.get('/session/:id/tabs/ws', async (c) => {
  const upgrade = c.req.header('Upgrade');
  if (upgrade?.toLowerCase() !== 'websocket') {
    return c.text('Expected WebSocket upgrade', 400);
  }

  const sessionId = c.req.param('id');
  const sessionState = getSessionState(c.env, sessionId);
  
  // Check if password is required (but don't block - let DO handle it)
  // We verify password here but still forward the upgrade request
  // The DO will handle the WebSocket connection regardless
  const infoRes = await sessionState.fetch(new Request('http://do/info'));
  if (infoRes.ok) {
    const info = await infoRes.json() as SessionInfo;
    if (info.hasPassword) {
      const password = c.req.query('password');
      if (password) {
        // Verify password, but don't block upgrade - just log if invalid
        const verifyRes = await sessionState.fetch(new Request('http://do/verify-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        }));
        if (!verifyRes.ok) {
          // Invalid password - reject the upgrade
          return c.json({ error: 'Invalid password' }, 401);
        }
      } else {
        // No password provided but required - reject
        return c.json({ error: 'Password required', hasPassword: true }, 401);
      }
    }
  }
  
  // Forward the WebSocket upgrade to the DO (with original request including query params)
  return sessionState.fetch(c.req.raw);
});

// Session cleanup
app.delete('/session/:id', async (c) => {
  const sessionId = c.req.param('id');
  const sandbox = getSandbox(c.env.Sandbox, sessionId);

  try {
    sessionAgents.delete(sessionId);
    // Tab state is now in SessionState DO, no need to delete here
    startedSessions.delete(sessionId);
    startingSessions.delete(sessionId);
    await sandbox.destroy();
    return c.json({ deleted: true });
  } catch (error) {
    console.error('Session deletion error:', error);
    return c.json({
      error: 'Failed to delete session',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Agent metadata for dumps
const AGENTS: Record<string, any> = {
  'claude': { id: 'claude', name: 'Claude Code' },
  'codex': { id: 'codex', name: 'OpenAI Codex' },
  'cursor': { id: 'cursor', name: 'Cursor CLI' },
  'opencode': { id: 'opencode', name: 'OpenCode' },
  'droid': { id: 'droid', name: 'Factory Droid' },
};

// Dump terminal session state (for forking/persistence)
app.post('/terminal/:sessionId/dump', async (c) => {
  const sessionId = c.req.param('sessionId');
  const sandbox = getSandbox(c.env.Sandbox, sessionId);

  try {
    // Query sandbox for current state
    const pwdResult = await sandbox.exec('pwd');
    const envResult = await sandbox.exec('env');
    const historyResult = await sandbox.exec('history | tail -50');

    const workingDir = pwdResult.success ? pwdResult.stdout.trim() : '/root';

    // Parse env vars (format: KEY=value)
    const envVars: Record<string, string> = {};
    if (envResult.success) {
      envResult.stdout.split('\n').forEach(line => {
        const [key, ...rest] = line.split('=');
        if (key && rest.length > 0) {
          envVars[key] = rest.join('=');
        }
      });
    }

    // Parse shell history
    const history: string[] = [];
    if (historyResult.success) {
      history.push(...historyResult.stdout
        .split('\n')
        .map(line => line.replace(/^\s*\d+\s+/, '')) // Remove line numbers
        .filter(line => line.trim())
      );
    }

    const agents = sessionAgents.get(sessionId) || [];

    return c.json({
      sessionId,
      timestamp: Date.now(),
      workingDir,
      envVars,
      history,
      agents,
      metadata: {
        agentList: agents.map(id => AGENTS[id] || { id, name: id })
      }
    });
  } catch (error) {
    console.error('Terminal dump error:', error);
    return c.json({
      error: 'Failed to dump session',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Fork a session (create new session with cloned state)
interface ForkRequest {
  dump: {
    workingDir: string;
    envVars: Record<string, string>;
    history?: string[];
    agents: string[];
  };
  name?: string;
}

app.post('/terminal/fork', async (c) => {
  try {
    const body = await c.req.json<ForkRequest>();
    const { dump } = body;

    if (!dump || !Array.isArray(dump.agents) || dump.agents.length === 0) {
      return c.json({ error: 'Invalid dump: missing agents' }, 400);
    }

    // Create new session
    const newSessionId = crypto.randomUUID().slice(0, 8);
    const sandbox = getSandbox(c.env.Sandbox, newSessionId);

    try {
      // Set up environment variables (only keep the ones that need to persist)
      const envVars: Record<string, string> = {
        PATH: '/root/.bun/bin:/root/.cursor/bin:/root/.factory/bin:/root/.local/bin:/usr/local/bin:/usr/bin:/bin',
      };

      // Preserve important env vars from original session
      if (dump.envVars.ANTHROPIC_API_KEY) envVars.ANTHROPIC_API_KEY = dump.envVars.ANTHROPIC_API_KEY;
      if (dump.envVars.OPENAI_API_KEY) envVars.OPENAI_API_KEY = dump.envVars.OPENAI_API_KEY;
      if (dump.envVars.CURSOR_API_KEY) envVars.CURSOR_API_KEY = dump.envVars.CURSOR_API_KEY;
      if (dump.envVars.FACTORY_API_KEY) envVars.FACTORY_API_KEY = dump.envVars.FACTORY_API_KEY;

      // Also preserve API keys from Cloudflare env if available
      if (c.env.ANTHROPIC_API_KEY) envVars.ANTHROPIC_API_KEY = c.env.ANTHROPIC_API_KEY;
      if (c.env.OPENAI_API_KEY) envVars.OPENAI_API_KEY = c.env.OPENAI_API_KEY;
      if (c.env.CURSOR_API_KEY) envVars.CURSOR_API_KEY = c.env.CURSOR_API_KEY;
      if (c.env.FACTORY_API_KEY) envVars.FACTORY_API_KEY = c.env.FACTORY_API_KEY;

      await sandbox.setEnvVars(envVars);

      // Install agents (same as main session start)
      const agents = dump.agents.filter((a: string) => typeof a === 'string');
      if (agents.includes('claude')) {
        await ensureCmd(sandbox, 'claude', 'bun add -g @anthropic-ai/claude-code');
      }
      if (agents.includes('codex')) {
        await ensureCmd(sandbox, 'codex', 'bun add -g @openai/codex');
      }
      if (agents.includes('cursor')) {
        await ensureCmd(sandbox, 'cursor-agent', 'curl -fsS https://cursor.com/install | bash');
      }
      if (agents.includes('opencode')) {
        await ensureCmd(sandbox, 'opencode', 'curl -fsSL https://opencode.ai/install | bash');
      }
      if (agents.includes('droid')) {
        await ensureCmd(sandbox, 'droid', 'curl -fsSL https://app.factory.ai/cli | sh');
      }

      // Store agents in session state
      sessionAgents.set(newSessionId, agents);
      const sessionState = getSessionState(c.env, newSessionId);
      await sessionState.fetch(new Request(new URL('/agents', c.req.url).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agents }),
      }));

      // Restore working directory + replay history as shell commands
      if (dump.history && dump.history.length > 0) {
        // Create a script that restores state
        const setupScript = [
          `cd ${dump.workingDir}`,
          ...dump.history.slice(-10) // Last 10 commands
        ].join('\n');

        // Write to a setup file (optional: could execute, but for now just prepare the env)
        await sandbox.exec(`bash -c "mkdir -p /tmp && cat > /tmp/fork-setup.sh << 'SETUP_EOF'\n${setupScript}\nSETUP_EOF"`);
      } else {
        // Just cd to working dir
        await sandbox.exec(`bash -c "cd ${dump.workingDir}"`);
      }

      startedSessions.add(newSessionId);

      return c.json({
        sessionId: newSessionId,
        forkedFrom: body,
        message: 'Session forked successfully'
      });
    } catch (error) {
      console.error('Fork setup error:', error);
      await sandbox.destroy();
      throw error;
    }
  } catch (error) {
    console.error('Terminal fork error:', error);
    return c.json({
      error: 'Failed to fork session',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

export default app;

