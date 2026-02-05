#!/usr/bin/env bun
/**
 * myfilepath.com PRD
 * 
 * Simpler approach: Just run bash gates in sequence until one fails.
 * 
 * Run with: bun run prd.ts
 */

import { $ } from "bun";

const BASE_URL = process.env.BASE_URL || "https://myfilepath.com";

const stories = [
  {
    id: "user-signup",
    title: "User can sign up via email/password",
    gateFile: "./gates/signup.gate.sh",
  },
  {
    id: "user-login",
    title: "User can log in with email/password",
    gateFile: "./gates/login.gate.sh",
  },
  {
    id: "api-key-creation",
    title: "Logged-in user can create API key",
    gateFile: "./gates/api-e2e.gate.sh",
  },
  {
    id: "container-creation",
    title: "System can spawn and manage Cloudflare Containers",
    gateFile: "./gates/terminal.gate.sh",
  },
  {
    id: "orchestrator-execute",
    title: "API key holder can execute task via /api/orchestrator",
    gateFile: "./gates/orchestrator.gate.sh",
  },
  {
    id: "north-star",
    title: "Full E2E: Sign up → Create API key → Execute task → Get result",
    gateFile: "./gates/full-user-lifecycle.gate.sh",
  },
];

let allPassed = true;

console.log("\n🎯 Running myfilepath.com PRD gates\n");
console.log(`Target: ${BASE_URL}\n`);

for (const story of stories) {
  console.log(`📝 [${story.id}] ${story.title}`);
  console.log(`   Gate: ${story.gateFile}`);

  try {
    await $`bash ${story.gateFile} ${BASE_URL}`.quiet();
    console.log(`   ✅ PASSED\n`);
  } catch (e) {
    console.error(`   ❌ FAILED\n`);
    allPassed = false;
    break; // Stop on first failure
  }
}

if (allPassed) {
  console.log("\n✅ All gates passed!\n");
  process.exit(0);
} else {
  console.log("\n❌ Gates failed. Fix and re-run.\n");
  process.exit(1);
}
