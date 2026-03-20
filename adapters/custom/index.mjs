/**
 * Custom harness adapter: Hermes Agent
 *
 * Bootstraps a pinned Hermes version at runtime, runs hermes chat one-shot,
 * then derives FAP events from git diffs.
 */
import { execSync, execFileSync } from "node:child_process";
import { mkdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const HERMES_CACHE = process.env.FILEPATH_HERMES_CACHE || "/opt/filepath/hermes-cache";
const DEFAULT_HERMES_VERSION = "main";

function emit(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

function readRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function parseJsonArrayEnv(name) {
  const raw = process.env[name]?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function parseHarnessConfig() {
  const raw = process.env.FILEPATH_HARNESS_CONFIG?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseLocalVerifyDirective(task) {
  const m = task.trim().match(/^__filepath_local_wait__:(\d+)(?::([\s\S]+))?$/);
  if (!m) return null;
  const delayMs = Math.min(Math.max(Number.parseInt(m[1], 10), 250), 60_000);
  const reply = m[2]?.trim() || `Waited ${delayMs}ms`;
  return { delayMs, reply };
}

function ensureHermesInstalled(version) {
  const venvDir = join(HERMES_CACHE, `v-${(version || DEFAULT_HERMES_VERSION).replace(/[^a-zA-Z0-9.-]/g, "_")}`);
  const hermesBin = join(venvDir, "bin", "hermes");

  if (existsSync(hermesBin)) return hermesBin;

  // If a previous run created a partial/stale venv, wipe it so `python -m venv`
  // can recreate cleanly.
  rmSync(venvDir, { recursive: true, force: true });
  mkdirSync(venvDir, { recursive: true });

  const py = process.env.FILEPATH_PYTHON;
  if (!py) throw new Error("FILEPATH_PYTHON is required");
  // Make errors actionable: if the sandbox image doesn't have this python,
  // you'll see a clear hint instead of a generic "/bin/sh: not found".
  if (py.startsWith("/") && !existsSync(py)) {
    throw new Error(
      `FILEPATH_PYTHON points to a missing executable in the sandbox: ${py} (sandbox image may be outdated).`,
    );
  }
  execSync(`${py} -m venv "${venvDir}"`, { stdio: "pipe" });
  const pip = join(venvDir, "bin", "pip");
  const ref = version && version !== "main" ? `@ git+https://github.com/NousResearch/hermes-agent.git@${version}` : "@ git+https://github.com/NousResearch/hermes-agent.git";
  execSync(`${pip} install --quiet "hermes-agent${ref}"`, { stdio: "pipe" });
  return hermesBin;
}

function getGitDiffFiles(workspaceRoot) {
  try {
    const out = execSync(
      `git diff --name-only HEAD 2>/dev/null || true`,
      { cwd: workspaceRoot, encoding: "utf8", maxBuffer: 1024 * 1024 },
    );
    return out
      .split(/\n/)
      .map((p) => p.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function getCommitInfo(workspaceRoot) {
  try {
    const rev = execSync(`git rev-parse HEAD 2>/dev/null || true`, {
      cwd: workspaceRoot,
      encoding: "utf8",
    }).trim();
    const msg = execSync(`git log -1 --format=%s 2>/dev/null || true`, {
      cwd: workspaceRoot,
      encoding: "utf8",
    }).trim();
    return rev && msg ? { sha: rev, message: msg } : null;
  } catch {
    return null;
  }
}

async function main() {
  const task = readRequiredEnv("FILEPATH_TASK");
  const apiKey = readRequiredEnv("FILEPATH_API_KEY");
  const model = readRequiredEnv("FILEPATH_MODEL");
  const workspaceRoot = readRequiredEnv("FILEPATH_WORKSPACE");
  const allowedPaths = parseJsonArrayEnv("FILEPATH_ALLOWED_PATHS");
  const forbiddenPaths = parseJsonArrayEnv("FILEPATH_FORBIDDEN_PATHS");
  const config = parseHarnessConfig();
  const hermesVersion = (config.hermesVersion || DEFAULT_HERMES_VERSION).toString();
  const localVerify = parseLocalVerifyDirective(task);

  emit({ type: "status", state: "thinking" });

  if (localVerify) {
    emit({ type: "status", state: "running" });
    await new Promise((r) => setTimeout(r, localVerify.delayMs));
    emit({ type: "text", content: localVerify.reply });
    emit({ type: "done", summary: "Agent completed the local verification task." });
    return;
  }

  const headBefore = getCommitInfo(workspaceRoot);

  const hermesBin = ensureHermesInstalled(hermesVersion);
  emit({ type: "status", state: "running" });

  const env = { ...process.env, OPENROUTER_API_KEY: apiKey };
  const toolsets = "terminal,skills";
  try {
    execFileSync(hermesBin, [
      "chat",
      "-q", task,
      "--provider", "openrouter",
      "-m", model,
      "-Q",
      "--yolo",
      "--toolsets", toolsets,
    ], { cwd: workspaceRoot, env, stdio: "pipe", maxBuffer: 50 * 1024 * 1024 });
  } catch (err) {
    const msg = err?.message || String(err);
    emit({ type: "text", content: `Hermes exited: ${msg.slice(0, 500)}` });
    emit({ type: "done", summary: "Hermes run completed with errors." });
    return;
  }

  const files = getGitDiffFiles(workspaceRoot);
  const normalizedAllowed = allowedPaths.length > 0 ? allowedPaths : ["."];
  const isAllowed = (path) =>
    normalizedAllowed.some((p) => path === p || path.startsWith(p.replace(/\/$/, "") + "/"));
  const isForbidden = (path) => forbiddenPaths.some((p) => path === p || path.startsWith(p.replace(/\/$/, "") + "/"));

  for (const path of files) {
    if (isAllowed(path) && !isForbidden(path)) {
      emit({ type: "tool", name: "write_file", path, status: "done" });
    }
  }

  const headAfter = getCommitInfo(workspaceRoot);
  const summary = files.length > 0 ? `Modified ${files.length} file(s).` : "Hermes completed.";
  emit({ type: "text", content: summary });

  if (headBefore && headAfter && headBefore.sha !== headAfter.sha) {
    emit({ type: "commit", sha: headAfter.sha, message: headAfter.message });
  }

  emit({ type: "done", summary });
}

main().catch((err) => {
  emit({ type: "text", content: `Adapter error: ${err?.message || String(err)}` });
  emit({ type: "done", summary: "Adapter failed." });
  process.exitCode = 1;
});
