import { getSandbox, Sandbox } from '@cloudflare/sandbox';
export { Sandbox };

interface Env {
  Sandbox: DurableObjectNamespace<Sandbox>;
}

const BIN = '/usr/local/bin/hello';

function buildCommand(): string {
  const script = [
    'const { accessSync, constants } = require("fs");',
    'const { spawnSync } = require("child_process");',
    `const bin = "${BIN}";`,
    'try { accessSync(bin, constants.X_OK); console.log("access ok"); }',
    'catch (e) { console.error("access failed", e && e.code); }',
    'const res = spawnSync(bin, [], { encoding: "utf8" });',
    'console.log("spawn status", res.status);',
    'console.log("spawn error", res.error && res.error.code, res.error && res.error.message);',
    'console.log("stdout", res.stdout);',
    'console.log("stderr", res.stderr);'
  ].join('\n');

  const escaped = script.replace(/'/g, "'\\''");
  return `bash -lc 'set -euo pipefail; echo "bin: ${BIN}"; ls -l ${BIN}; printf "%s" '${escaped}' | node'`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/repro') {
      const sandboxId = url.searchParams.get('id') || 'repro';
      const sandbox = getSandbox(env.Sandbox, sandboxId);
      let lastError: unknown = null;
      let result:
        | { exitCode?: number | null; stdout?: string; stderr?: string }
        | null = null;
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        try {
          result = await sandbox.exec(buildCommand());
          break;
        } catch (error) {
          lastError = error;
          await new Promise((resolve) => setTimeout(resolve, attempt * 250));
        }
      }
      if (!result) {
        return new Response(
          JSON.stringify(
            {
              error: String(lastError)
            },
            null,
            2
          ),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify(
          {
            exitCode: result.exitCode ?? null,
            stdout: result.stdout,
            stderr: result.stderr
          },
          null,
          2
        ),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response('OK', { status: 200 });
  }
};
