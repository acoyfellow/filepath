import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const WORKSPACE = process.cwd();
const PID_DIR = path.join(WORKSPACE, ".alchemy", "pids");
const PORTS = [1337, 5173];

function run(command, args) {
  return spawnSync(command, args, {
    cwd: WORKSPACE,
    encoding: "utf8",
  });
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function collectPidFiles() {
  try {
    return readdirSync(PID_DIR)
      .filter((entry) => entry.endsWith(".pid.json"))
      .map((entry) => path.join(PID_DIR, entry));
  } catch {
    return [];
  }
}

function collectPidsFromFiles() {
  const pids = new Set();
  for (const filePath of collectPidFiles()) {
    try {
      const payload = JSON.parse(readFileSync(filePath, "utf8"));
      const pid = Number(payload.pid);
      if (Number.isInteger(pid) && pid > 0) {
        pids.add(pid);
      }
    } catch {
      // Ignore malformed pid files.
    }
  }
  return pids;
}

function collectListeningPids() {
  const pids = new Set();
  for (const port of PORTS) {
    const result = run("lsof", ["-ti", `tcp:${port}`]);
    if (result.status !== 0) continue;

    for (const line of result.stdout.split("\n")) {
      const pid = Number(line.trim());
      if (Number.isInteger(pid) && pid > 0) {
        pids.add(pid);
      }
    }
  }
  return pids;
}

function collectRepoDevPids() {
  const result = run("ps", ["-Ao", "pid=,command="]);
  const pids = new Set();
  if (result.status !== 0) return pids;

  for (const line of result.stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes(WORKSPACE)) continue;
    if (
      !trimmed.includes("alchemy.run.ts") &&
      !trimmed.includes("node_modules/.bin/alchemy dev") &&
      !trimmed.includes("node_modules/.bin/vite dev")
    ) {
      continue;
    }

    const pid = Number(trimmed.split(/\s+/, 1)[0]);
    if (Number.isInteger(pid) && pid > 0) {
      pids.add(pid);
    }
  }

  return pids;
}

function terminate(pid) {
  if (!isAlive(pid)) return;
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return;
  }
}

function forceTerminate(pid) {
  if (!isAlive(pid)) return;
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // Ignore races.
  }
}

const targetPids = new Set([
  ...collectPidsFromFiles(),
  ...collectListeningPids(),
  ...collectRepoDevPids(),
]);

if (targetPids.size === 0) {
  console.log("No local dev processes found.");
  process.exit(0);
}

for (const pid of targetPids) {
  terminate(pid);
}

await new Promise((resolve) => setTimeout(resolve, 1200));

for (const pid of targetPids) {
  forceTerminate(pid);
}

console.log(`Stopped ${targetPids.size} local dev process(es).`);
