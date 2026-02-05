#!/usr/bin/env bun
/**
 * myfilepath.com PRD
 * 
 * Build in reverse: define what should work, verify with gates.
 * Run with: bun run prd.ts
 * 
 * Each story is a feature that must work. Gates prove it works.
 * Stories execute in dependency order, stopping on first failure.
 */

import { definePrd, runPrd } from "gateproof";

export const prd = definePrd({
  stories: [
    {
      id: "user-signup",
      title: "User can sign up via email/password",
      gateFile: "./gates/signup.gate.sh",
      scope: {
        allowedPaths: [
          "src/routes/signup/**",
          "src/lib/auth.ts",
          "gates/signup.gate.sh",
        ],
        maxChangedFiles: 10,
        maxChangedLines: 500,
      },
    },
    {
      id: "user-login",
      title: "User can log in with email/password",
      gateFile: "./gates/login.gate.sh",
      dependsOn: ["user-signup"],
      scope: {
        allowedPaths: [
          "src/routes/login/**",
          "src/lib/auth.ts",
          "gates/login.gate.sh",
        ],
        maxChangedFiles: 10,
        maxChangedLines: 500,
      },
    },
    {
      id: "api-key-creation",
      title: "Logged-in user can create API key",
      gateFile: "./gates/api-e2e.gate.sh",
      dependsOn: ["user-login"],
      scope: {
        allowedPaths: [
          "src/routes/settings/api-keys/**",
          "src/routes/api/keys/**",
          "gates/api-e2e.gate.sh",
        ],
        maxChangedFiles: 15,
        maxChangedLines: 800,
      },
    },
    {
      id: "container-creation",
      title: "System can spawn and manage Cloudflare Containers",
      gateFile: "./gates/terminal.gate.sh",
      dependsOn: ["api-key-creation"],
      scope: {
        allowedPaths: [
          "src/lib/containers.ts",
          "src/agent/workflows/create-session.ts",
          "gates/terminal.gate.sh",
        ],
        maxChangedFiles: 10,
        maxChangedLines: 600,
      },
    },
    {
      id: "orchestrator-execute",
      title: "API key holder can execute task via /api/orchestrator",
      gateFile: "./gates/orchestrator.gate.sh",
      dependsOn: ["container-creation"],
      scope: {
        allowedPaths: [
          "src/routes/api/orchestrator/**",
          "src/agent/task-agent.ts",
          "src/agent/workflows/execute-task.ts",
          "gates/orchestrator.gate.sh",
        ],
        maxChangedFiles: 15,
        maxChangedLines: 1000,
      },
    },
    {
      id: "north-star",
      title: "Full E2E: Sign up → Create API key → Execute task → Get result",
      gateFile: "./gates/full-user-lifecycle.gate.sh",
      dependsOn: ["orchestrator-execute"],
      scope: {
        allowedPaths: [
          "gates/full-user-lifecycle.gate.sh",
          "**/*.ts",
          "**/*.svelte",
        ],
        maxChangedFiles: 30,
        maxChangedLines: 2000,
      },
    },
  ],
});

// Run gates in order, stop on first failure
if (import.meta.main) {
  const result = await runPrd(prd);
  process.exit(result.allPassed ? 0 : 1);
}
