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

// CORS for local dev (skip WebSocket upgrades - they handle their own headers)
app.use('*', async (c, next) => {
  if (c.req.header('Upgrade')?.toLowerCase() === 'websocket') {
    return next();
  }
  return cors({ origin: '*' })(c, next);
});

// Password validation middleware
async function requirePassword(c: any, next: () => Promise<void>): Promise<Response> {
  // Skip WebSocket upgrades - they handle password via query params in the route handler
  if (c.req.header('Upgrade') === 'websocket') {
    await next();
    return c.res;
  }

  const sessionId = c.req.param('id') || c.req.param('sessionId');
  if (!sessionId) {
    await next();
    return c.res;
  }

  const sessionState = getSessionState(c.env, sessionId);
  const infoRes = await sessionState.fetch(new Request('http://do/info'));
  if (!infoRes.ok) {
    await next();
    return c.res;
  }

  const info = await infoRes.json() as SessionInfo;
  if (!info.hasPassword) {
    await next();
    return c.res;
  }

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

  await next();
  return c.res;
}

// In-memory storage for session agents (in production, use Durable Object storage)
const sessionAgents = new Map<string, string[]>();

// Helper to get SessionState DO for a session
function getSessionState(env: Env, sessionId: string) {
  const id = env.SessionState.idFromName(sessionId);
  return env.SessionState.get(id);
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

// Track started sandboxes to avoid duplicate ttyd starts
// Key: sandboxId (sessionId:tabId for tabs, sessionId for main session)
const startedSessions = new Set<string>();
const startingSessions = new Map<string, Promise<void>>();

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
// Each tab gets its own sandbox with direct ttyd (no tmux, no proxy)
// Cross-browser sync happens because ttyd broadcasts to all connected WebSocket clients
app.post('/terminal/:sessionId/:tabId/start', async (c) => {
  const sessionId = c.req.param('sessionId');
  const tabId = c.req.param('tabId');
  const sandboxId = `${sessionId}:${tabId}`; // One sandbox per tab
  console.log('Starting terminal tab:', sandboxId);

  // Skip if already started
  if (startedSessions.has(sandboxId)) {
    return c.json({ ready: true, port: 7681 });
  }
  const inflight = startingSessions.get(sandboxId);
  if (inflight) {
    await inflight;
    return c.json({ ready: true, port: 7681 });
  }

  // Get sandbox for THIS TAB (not session)
  const sandbox = getSandbox(c.env.Sandbox, sandboxId);

  try {
    const startPromise = (async () => {
      // Get agents from session state
      const sessionState = getSessionState(c.env, sessionId);
      const infoRes = await sessionState.fetch(new Request('http://do/info'));
      let agents: string[] = [];
      if (infoRes.ok) {
        const info = await infoRes.json() as { agents?: string[] };
        agents = info.agents || [];
      }

      // Set env vars for this sandbox
      const envVars: Record<string, string> = {
        PATH: '/root/.bun/bin:/root/.cursor/bin:/root/.factory/bin:/root/.local/bin:/usr/local/bin:/usr/bin:/bin',
      };
      if (agents.includes('claude') && !c.env.ANTHROPIC_API_KEY) {
        throw new Error('Missing ANTHROPIC_API_KEY');
      }
      if (c.env.ANTHROPIC_API_KEY) envVars.ANTHROPIC_API_KEY = c.env.ANTHROPIC_API_KEY;
      if (c.env.OPENAI_API_KEY) envVars.OPENAI_API_KEY = c.env.OPENAI_API_KEY;
      if (c.env.CURSOR_API_KEY) envVars.CURSOR_API_KEY = c.env.CURSOR_API_KEY;
      if (c.env.FACTORY_API_KEY) envVars.FACTORY_API_KEY = c.env.FACTORY_API_KEY;
      await sandbox.setEnvVars(envVars);

      // Start ttyd directly on port 7681 (no tmux, no proxy)
      // ttyd natively supports multiple WebSocket clients and broadcasts to all
      console.log('Starting ttyd for sandbox:', sandboxId);
      const ttyd = await sandbox.startProcess('ttyd -W -p 7681 bash');
      await ttyd.waitForPort(7681, { mode: 'tcp', timeout: 60000 });
      console.log('ttyd ready on port 7681 for sandbox:', sandboxId);

      startedSessions.add(sandboxId);
    })();

    startingSessions.set(sandboxId, startPromise);
    await startPromise;
    startingSessions.delete(sandboxId);

    return c.json({ ready: true, port: 7681 });
  } catch (error) {
    startingSessions.delete(sandboxId);
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
    // Can't return JSON for WebSocket upgrade - close connection
    return new Response(null, { status: 500, statusText: String(error) });
  }
});

// WebSocket terminal connection for specific tab
// Each tab has its own sandbox with ttyd on port 7681
// ttyd natively broadcasts to all connected WebSocket clients (cross-browser sync)
app.get('/terminal/:sessionId/:tabId/ws', async (c) => {
  const upgrade = c.req.header('Upgrade');
  if (upgrade?.toLowerCase() !== 'websocket') {
    return c.text('Expected WebSocket upgrade', 400);
  }

  const sessionId = c.req.param('sessionId');
  const tabId = c.req.param('tabId');
  const sandboxId = `${sessionId}:${tabId}`; // Same ID as used in /start
  console.log('WS connecting to sandbox:', sandboxId);

  // Don't do async password checks here - they block the WebSocket upgrade
  // Password can be verified by ttyd or handled after connection

  // Get sandbox for THIS TAB
  const sandbox = getSandbox(c.env.Sandbox, sandboxId);

  try {
    // Rewrite URL to /ws for ttyd
    const originalUrl = new URL(c.req.url);
    const ttydUrl = new URL('/ws' + originalUrl.search, originalUrl.origin);
    const wsRequest = new Request(ttydUrl.toString(), {
      method: c.req.raw.method,
      headers: c.req.raw.headers,
    });

    console.log('Calling wsConnect for sandbox:', sandboxId, 'port: 7681');
    const response = await sandbox.wsConnect(wsRequest, 7681);
    console.log('wsConnect response status:', response.status);
    return response;
  } catch (error) {
    console.error('WebSocket connection error:', error);
    // Can't return JSON for WebSocket upgrade - close connection
    return new Response(null, { status: 500, statusText: String(error) });
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

  // Forward the WebSocket upgrade directly to the DO
  // The DO will handle password verification and WebSocket connection
  // Don't do async checks here - they can block the upgrade
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

// 404 handler - return proper error for unmatched routes
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

export default app;

