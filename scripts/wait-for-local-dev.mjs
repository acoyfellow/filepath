import { spawnSync } from "node:child_process";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";
const EXPECTED_WORKER_PORT = process.env.WORKER_PORT || "1337";
const DEADLINE_MS = 90_000;
const INTERVAL_MS = 1_000;

function portListening(port) {
  const result = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], {
    encoding: "utf8",
  });
  return result.status === 0;
}

const startedAt = Date.now();
for (;;) {
  if (Date.now() - startedAt > DEADLINE_MS) {
    console.error("Timed out waiting for local dev stack.");
    process.exit(1);
  }

  try {
    const response = await fetch(`${BASE_URL}/api/config`);
    if (!response.ok) {
      throw new Error(`/api/config returned ${response.status}`);
    }

    const payload = await response.json();
    const workerUrl = typeof payload.workerUrl === "string" ? payload.workerUrl : "";
    const worker = workerUrl ? new URL(workerUrl) : null;

    if (
      worker &&
      worker.hostname === "localhost" &&
      worker.port === EXPECTED_WORKER_PORT &&
      portListening("5173") &&
      portListening(EXPECTED_WORKER_PORT)
    ) {
      console.log(`Local dev ready: app=${BASE_URL} worker=${workerUrl}`);
      process.exit(0);
    }
  } catch {
    // Keep polling until the stack is healthy.
  }

  await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
}
