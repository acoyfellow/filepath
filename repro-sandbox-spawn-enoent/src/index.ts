import { getSandbox, Sandbox } from '@cloudflare/sandbox';
export { Sandbox };

interface Env {
  Sandbox: DurableObjectNamespace<Sandbox>;
}

type ExecResult = { exitCode?: number | null; stdout?: string; stderr?: string };

const BINS = {
  hello: '/usr/local/bin/hello',
  script: '/usr/local/bin/hello-script',
  static: '/usr/local/bin/hello-static',
  dynamic: '/usr/local/bin/hello-dynamic',
  claude: '/usr/local/bin/claude',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function execWithRetry(
  sandbox: ReturnType<typeof getSandbox>,
  cmd: string,
  attempts = 5
): Promise<ExecResult> {
  let lastError: unknown = null;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await sandbox.exec(cmd);
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, i * 500));
    }
  }
  return {
    exitCode: -1,
    stdout: '',
    stderr: `exec failed after ${attempts} attempts: ${String(lastError)}`,
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Endpoint: /repro  (original, kept for backwards compat)
// ---------------------------------------------------------------------------

function buildReproCommand(): string {
  const script = [
    'const { accessSync, constants } = require("fs");',
    'const { spawnSync } = require("child_process");',
    `const bin = "${BINS.hello}";`,
    'try { accessSync(bin, constants.X_OK); console.log("access ok"); }',
    'catch (e) { console.error("access failed", e && e.code); }',
    'const res = spawnSync(bin, [], { encoding: "utf8" });',
    'console.log("spawn status", res.status);',
    'console.log("spawn error", res.error && res.error.code, res.error && res.error.message);',
    'console.log("stdout", res.stdout);',
    'console.log("stderr", res.stderr);',
  ].join('\n');

  const escaped = script.replace(/'/g, "'\\''");
  return `bash -lc 'set -euo pipefail; echo "bin: ${BINS.hello}"; ls -l ${BINS.hello}; printf "%s" '${escaped}' | node'`;
}

// ---------------------------------------------------------------------------
// Endpoint: /diagnostics  — deep filesystem / ELF / linker checks
// ---------------------------------------------------------------------------

function buildDiagnosticsCommand(): string {
  const cmds = [
    'echo "=== uname ==="',
    'uname -a',
    'echo "=== arch ==="',
    'uname -m',

    // file type for each binary
    ...Object.entries(BINS).flatMap(([label, path]) => [
      `echo "=== file ${label} ==="`,
      `file ${path} 2>&1 || echo "file failed for ${path}"`,
    ]),

    // ldd for each binary
    ...Object.entries(BINS).flatMap(([label, path]) => [
      `echo "=== ldd ${label} ==="`,
      `ldd ${path} 2>&1 || echo "ldd failed for ${path}"`,
    ]),

    // readelf interpreter for each binary
    ...Object.entries(BINS).flatMap(([label, path]) => [
      `echo "=== readelf ${label} ==="`,
      `readelf -l ${path} 2>&1 | grep -i interpreter || echo "no ELF interpreter for ${path}"`,
    ]),

    // Check common linker paths
    'echo "=== linker paths ==="',
    'ls -la /lib64/ld-linux-x86-64.so.2 2>&1 || echo "no /lib64/ld-linux-x86-64.so.2"',
    'ls -la /lib/ld-linux-aarch64.so.1 2>&1 || echo "no /lib/ld-linux-aarch64.so.1"',
    'ls -la /lib/x86_64-linux-gnu/ld-linux-x86-64.so.2 2>&1 || echo "no /lib/x86_64-linux-gnu variant"',

    // xxd first bytes of each binary
    ...Object.entries(BINS).flatMap(([label, path]) => [
      `echo "=== xxd ${label} ==="`,
      `head -c 256 ${path} 2>/dev/null | xxd | head -5 || echo "xxd failed for ${path}"`,
    ]),

    // PATH and permissions
    'echo "=== env PATH ==="',
    'echo $PATH',
    ...Object.entries(BINS).flatMap(([label, path]) => [
      `echo "=== stat ${label} ==="`,
      `stat ${path} 2>&1 || echo "stat failed for ${path}"`,
    ]),

    // Try running via explicit linker
    'echo "=== explicit linker: hello-dynamic ==="',
    '/lib64/ld-linux-x86-64.so.2 /usr/local/bin/hello-dynamic 2>&1 || echo "explicit linker failed (x86-64)"',
    '/lib/ld-linux-aarch64.so.1 /usr/local/bin/hello-dynamic 2>&1 || echo "explicit linker failed (aarch64)"',
  ];
  return cmds.join('\n');
}

// ---------------------------------------------------------------------------
// Endpoint: /spawn-test  — static vs dynamic vs script spawn
// ---------------------------------------------------------------------------

function buildSpawnTestCommand(): string {
  const bins = [
    { label: 'hello (shell script)',   path: BINS.hello },
    { label: 'hello-script',           path: BINS.script },
    { label: 'hello-static',           path: BINS.static },
    { label: 'hello-dynamic',          path: BINS.dynamic },
  ];

  const lines: string[] = [
    'const { accessSync, constants, statSync } = require("fs");',
    'const { spawnSync } = require("child_process");',
    'const results = {};',
  ];

  for (const { label, path } of bins) {
    lines.push(`
{
  const bin = "${path}";
  const entry = { path: bin };
  try { accessSync(bin, constants.X_OK); entry.accessOk = true; }
  catch (e) { entry.accessOk = false; entry.accessError = e.code; }
  try { const s = statSync(bin); entry.size = s.size; entry.mode = "0" + (s.mode & 0o7777).toString(8); }
  catch (e) { entry.statError = e.code; }

  const res = spawnSync(bin, [], { encoding: "utf8", timeout: 10000 });
  entry.spawnStatus = res.status;
  entry.spawnStdout = (res.stdout || "").trim();
  entry.spawnStderr = (res.stderr || "").trim();
  if (res.error) {
    entry.spawnError = { code: res.error.code, errno: res.error.errno, syscall: res.error.syscall, path: res.error.path, message: res.error.message };
  }
  results["${label}"] = entry;
}
`);
  }

  lines.push('console.log(JSON.stringify(results, null, 2));');
  const script = lines.join('\n');
  const escaped = script.replace(/'/g, "'\\''");
  return `bash -lc 'printf '"'"'%s'"'"' '"'"'${escaped}'"'"' | node'`;
}

// ---------------------------------------------------------------------------
// Endpoint: /workerd-compat  — child_process compat matrix
// ---------------------------------------------------------------------------

function buildWorkerdCompatCommand(): string {
  const script = `
const { execSync, spawnSync } = require("child_process");
const results = {};

// Test 1: execSync (uses shell)
try {
  const out = execSync("/usr/local/bin/hello-static", { encoding: "utf8", timeout: 10000 });
  results.execSync_static = { ok: true, stdout: out.trim() };
} catch (e) {
  results.execSync_static = { ok: false, code: e.code, message: e.message };
}

// Test 2: spawnSync with shell: true
{
  const r = spawnSync("/usr/local/bin/hello-static", [], { encoding: "utf8", shell: true, timeout: 10000 });
  results.spawnSync_shell_true = { status: r.status, stdout: (r.stdout||"").trim(), error: r.error ? { code: r.error.code, errno: r.error.errno, syscall: r.error.syscall, path: r.error.path } : null };
}

// Test 3: spawnSync with explicit env, shell: false
{
  const r = spawnSync("/usr/local/bin/hello-static", [], { encoding: "utf8", shell: false, env: { PATH: "/usr/local/bin:/usr/bin:/bin" }, timeout: 10000 });
  results.spawnSync_explicit_env = { status: r.status, stdout: (r.stdout||"").trim(), error: r.error ? { code: r.error.code, errno: r.error.errno, syscall: r.error.syscall, path: r.error.path } : null };
}

// Test 4: spawnSync /bin/ls (built-in binary)
{
  const r = spawnSync("/bin/ls", ["-la", "/usr/local/bin/"], { encoding: "utf8", timeout: 10000 });
  results.spawnSync_bin_ls = { status: r.status, stdout: (r.stdout||"").trim().split("\\n").slice(0, 10).join("\\n"), error: r.error ? { code: r.error.code, errno: r.error.errno, syscall: r.error.syscall, path: r.error.path } : null };
}

// Test 5: spawnSync on each binary type
const binaries = [
  ["hello_shell", "/usr/local/bin/hello"],
  ["hello_script", "/usr/local/bin/hello-script"],
  ["hello_static", "/usr/local/bin/hello-static"],
  ["hello_dynamic", "/usr/local/bin/hello-dynamic"],
];
for (const [label, path] of binaries) {
  const r = spawnSync(path, [], { encoding: "utf8", shell: false, timeout: 10000 });
  results["spawn_" + label] = { status: r.status, stdout: (r.stdout||"").trim(), error: r.error ? { code: r.error.code, errno: r.error.errno, syscall: r.error.syscall, path: r.error.path } : null };
}

// Test 6: spawnSync with shell:true on each binary
for (const [label, path] of binaries) {
  const r = spawnSync(path, [], { encoding: "utf8", shell: true, timeout: 10000 });
  results["spawn_shell_" + label] = { status: r.status, stdout: (r.stdout||"").trim(), error: r.error ? { code: r.error.code, errno: r.error.errno, syscall: r.error.syscall, path: r.error.path } : null };
}

console.log(JSON.stringify(results, null, 2));
`;
  const escaped = script.replace(/'/g, "'\\''");
  return `bash -lc 'printf '"'"'%s'"'"' '"'"'${escaped}'"'"' | node'`;
}

// ---------------------------------------------------------------------------
// Endpoint: /delay-test  — startup-window hypothesis (PR #364)
// ---------------------------------------------------------------------------

async function handleDelayTest(
  env: Env,
  sandboxId: string,
  delaySec: number
): Promise<Response> {
  const sandbox = getSandbox(env.Sandbox, `delay-${sandboxId}`);
  const timeline: { ts: number; event: string; data?: unknown }[] = [];
  const t0 = Date.now();
  const mark = (event: string, data?: unknown) =>
    timeline.push({ ts: Date.now() - t0, event, data });

  mark('sandbox_created');

  // Wait the requested delay
  mark('delay_start', { seconds: delaySec });
  await new Promise((r) => setTimeout(r, delaySec * 1000));
  mark('delay_end');

  // Warm up: simple exec first
  const warmup = await execWithRetry(sandbox, 'echo warmup-ok');
  mark('warmup', { exitCode: warmup.exitCode, stdout: warmup.stdout?.trim() });

  // Now run the spawn tests
  const script = `
const { spawnSync } = require("child_process");
const bins = [
  ["/usr/local/bin/hello", "shell_script"],
  ["/usr/local/bin/hello-static", "static"],
  ["/usr/local/bin/hello-dynamic", "dynamic"],
];
const results = {};
for (const [path, label] of bins) {
  const r = spawnSync(path, [], { encoding: "utf8", timeout: 10000 });
  results[label] = {
    status: r.status,
    stdout: (r.stdout||"").trim(),
    error: r.error ? { code: r.error.code, errno: r.error.errno, syscall: r.error.syscall, path: r.error.path, message: r.error.message } : null,
  };
}
console.log(JSON.stringify(results));
`;
  const escaped = script.replace(/'/g, "'\\''");
  const cmd = `bash -lc 'printf '"'"'%s'"'"' '"'"'${escaped}'"'"' | node'`;
  const result = await execWithRetry(sandbox, cmd);
  mark('spawn_test', { exitCode: result.exitCode });

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(result.stdout?.trim() || '{}');
  } catch {
    parsed = { raw_stdout: result.stdout, raw_stderr: result.stderr };
  }

  mark('done');

  return json({
    delaySec,
    timeline,
    spawnResults: parsed,
    rawStdout: result.stdout,
    rawStderr: result.stderr,
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const sandboxId = url.searchParams.get('id') || 'repro';

    // Original repro endpoint
    if (url.pathname === '/repro') {
      const sandbox = getSandbox(env.Sandbox, sandboxId);
      const result = await execWithRetry(sandbox, buildReproCommand());
      return json({
        exitCode: result.exitCode ?? null,
        stdout: result.stdout,
        stderr: result.stderr,
      });
    }

    // Step 2: Deep filesystem / ELF / linker diagnostics
    if (url.pathname === '/diagnostics') {
      const sandbox = getSandbox(env.Sandbox, sandboxId);
      const result = await execWithRetry(sandbox, buildDiagnosticsCommand());
      return json({
        exitCode: result.exitCode ?? null,
        stdout: result.stdout,
        stderr: result.stderr,
      });
    }

    // Step 3: Static vs dynamic vs script spawn test
    if (url.pathname === '/spawn-test') {
      const sandbox = getSandbox(env.Sandbox, sandboxId);
      const result = await execWithRetry(sandbox, buildSpawnTestCommand());
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(result.stdout?.trim() || '{}');
      } catch {
        parsed = null;
      }
      return json({
        exitCode: result.exitCode ?? null,
        parsed,
        rawStdout: result.stdout,
        rawStderr: result.stderr,
      });
    }

    // Step 4: workerd child_process compatibility matrix
    if (url.pathname === '/workerd-compat') {
      const sandbox = getSandbox(env.Sandbox, sandboxId);
      const result = await execWithRetry(sandbox, buildWorkerdCompatCommand());
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(result.stdout?.trim() || '{}');
      } catch {
        parsed = null;
      }
      return json({
        exitCode: result.exitCode ?? null,
        parsed,
        rawStdout: result.stdout,
        rawStderr: result.stderr,
      });
    }

    // Step 5: Startup-window delay test
    if (url.pathname === '/delay-test') {
      const delaySec = parseInt(url.searchParams.get('delay') || '30', 10);
      return handleDelayTest(env, sandboxId, delaySec);
    }

    // Index: list all endpoints
    if (url.pathname === '/') {
      return json({
        endpoints: {
          '/repro': 'Original spawn ENOENT repro (hello shell script)',
          '/diagnostics': 'Deep filesystem/ELF/linker diagnostics (file, ldd, readelf, xxd)',
          '/spawn-test': 'Static vs dynamic vs script spawnSync test',
          '/workerd-compat': 'workerd child_process compat matrix (execSync, shell:true, /bin/ls)',
          '/delay-test?delay=30': 'Startup-window hypothesis — wait N seconds then spawn (default 30s)',
        },
        params: {
          id: 'Sandbox instance ID (default: "repro")',
          delay: 'Seconds to wait before spawn in /delay-test (default: 30)',
        },
      });
    }

    return new Response('Not found', { status: 404 });
  },
};
