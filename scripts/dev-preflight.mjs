import { spawnSync } from "node:child_process";

const WATCH_PORTS = [1337, 5173];
const WORKSPACE = process.cwd();

function run(command, args) {
  return spawnSync(command, args, {
    cwd: WORKSPACE,
    encoding: "utf8",
  });
}

function listListeners(port) {
  const result = run("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"]);
  if (result.status !== 0) {
    return [];
  }

  const lines = result.stdout.trim().split("\n").slice(1).filter(Boolean);
  return lines.map((line) => line.trim());
}

function findRepoDevProcesses() {
  const result = run("ps", ["-Ao", "pid=,command="]);
  if (result.status !== 0) {
    return [];
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) =>
      line.includes(WORKSPACE) &&
      (
        line.includes("alchemy.run.ts") ||
        line.includes("node_modules/.bin/alchemy dev") ||
        line.includes("node_modules/.bin/vite dev")
      ),
    );
}

const portConflicts = WATCH_PORTS.flatMap((port) =>
  listListeners(port).map((listener) => ({ port, listener })),
);
const repoProcesses = findRepoDevProcesses();

if (portConflicts.length === 0 && repoProcesses.length === 0) {
  console.log("Dev preflight passed: localhost ports are clear.");
  process.exit(0);
}

console.error("Dev preflight failed: stale local dev processes detected.");
if (portConflicts.length > 0) {
  console.error("");
  console.error("Listening ports:");
  for (const conflict of portConflicts) {
    console.error(`- :${conflict.port} ${conflict.listener}`);
  }
}

if (repoProcesses.length > 0) {
  console.error("");
  console.error("Repo dev processes:");
  for (const processLine of repoProcesses) {
    console.error(`- ${processLine}`);
  }
}

console.error("");
console.error("Run `bun run dev:stop` before starting a fresh local stack.");
process.exit(1);
