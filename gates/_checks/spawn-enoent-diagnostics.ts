#!/usr/bin/env bun

/**
 * Gate check: verify the sandbox warmup workaround (SDK #309) works in prod.
 *
 * 1. POST /terminal/{session}/{tab}/start  — triggers startTerminal() with warmup
 * 2. POST /terminal/{session}/{tab}/task   — runs a command via sandbox.exec()
 * 3. DELETE /session/{session}             — clean up
 *
 * The warmup retries up to 10x with linear backoff, so terminal/start can
 * take over 60s on a cold sandbox. All fetches use AbortController timeouts.
 */

// Use myfilepath.com (not api.) to match the human path through the Vite proxy
const BASE = process.env.GATE_BASE_URL || 'https://myfilepath.com';
const SESSION_ID = `gate-${Date.now()}`;
const TAB_ID = 'tab1';

interface TaskResult {
  task?: {
    id: string;
    status: string;
    exitCode?: number | null;
    stdout?: string;
    stderr?: string;
  };
  error?: string;
}

const results: Record<string, unknown> = {};
let failed = false;

function mark(name: string, ok: boolean, data: unknown) {
  results[name] = data;
  if (!ok) failed = true;
  console.log(`${name} ... ${ok ? 'OK' : 'FAIL'}`);
}

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// Step 1: start terminal (exercises the warmup path — can take 60s+ on cold start)
try {
  process.stdout.write('terminal/start ... ');
  const res = await fetchWithTimeout(
    `${BASE}/terminal/${SESSION_ID}/${TAB_ID}/start`,
    { method: 'POST' },
    90_000,
  );
  const body = await res.json();
  mark('terminal/start', res.ok, body);
} catch (err) {
  mark('terminal/start', false, { error: String(err) });
}

// Step 2: exec a simple command (proves sandbox is alive post-warmup)
try {
  process.stdout.write('terminal/task(echo) ... ');
  const res = await fetchWithTimeout(
    `${BASE}/terminal/${SESSION_ID}/${TAB_ID}/task`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'echo hello-from-gate', actor: 'agent' }),
    },
    30_000,
  );
  const body = (await res.json()) as TaskResult;
  const stdout = body.task?.stdout?.trim() ?? '';
  const ok = res.ok && stdout === 'hello-from-gate';
  mark('terminal/task(echo)', ok, body);
} catch (err) {
  mark('terminal/task(echo)', false, { error: String(err) });
}

// Step 3: exec uname to confirm full binary execution works
try {
  process.stdout.write('terminal/task(uname) ... ');
  const res = await fetchWithTimeout(
    `${BASE}/terminal/${SESSION_ID}/${TAB_ID}/task`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'uname -a', actor: 'agent' }),
    },
    30_000,
  );
  const body = (await res.json()) as TaskResult;
  const ok = res.ok && (body.task?.exitCode === 0);
  mark('terminal/task(uname)', ok, body);
} catch (err) {
  mark('terminal/task(uname)', false, { error: String(err) });
}

// Step 4: cleanup — delete the session
try {
  process.stdout.write('session/cleanup ... ');
  const res = await fetchWithTimeout(
    `${BASE}/session/${SESSION_ID}`,
    { method: 'DELETE' },
    15_000,
  );
  const body = await res.json();
  mark('session/cleanup', res.ok, body);
} catch (err) {
  mark('session/cleanup', false, { error: String(err) });
}

console.log('\n' + JSON.stringify(results, null, 2));

if (failed) {
  process.exit(1);
}
