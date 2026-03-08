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
  console.log("\nfilepath production proof (loop mode)\n");
  console.log(`Target: ${baseUrl}`);
  console.log("Release bar: visual-regression + agent-chat + api-key-auth");
  console.log("");

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    console.log(`Attempt ${attempt}/${maxAttempts}`);
    const result = runSuite();
    if (result.status === 0) {
      process.exit(0);
    }

    if (attempt < maxAttempts) {
      console.log("");
    }
  }

  process.exit(1);
}

console.log("\nfilepath production proof\n");
console.log(`Target: ${baseUrl}`);
console.log("Release bar: visual-regression + agent-chat + api-key-auth");
console.log("Required env: TEST_EMAIL, TEST_PASSWORD, TEST_OPENROUTER_KEY");
console.log("");

const result = runSuite();
process.exit(result.status ?? 1);
