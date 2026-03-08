#!/usr/bin/env bun

import { spawnSync } from "node:child_process";

const loop = process.argv.includes("--loop");
const baseUrl = process.env.BASE_URL || "https://myfilepath.com";
const maxAttempts = 5;

function runSuite() {
  return spawnSync("bash", ["./gates/production/run-all.sh", baseUrl], {
    stdio: "inherit",
    env: process.env,
  });
}

if (loop) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = runSuite();
    if (result.status === 0) {
      process.exit(0);
    }
  }

  process.exit(1);
}

const result = runSuite();
process.exit(result.status ?? 1);
