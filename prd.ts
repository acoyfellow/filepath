#!/usr/bin/env bun
/**
 * filepath PRD -- Gate-driven development
 *
 * Run with: bun run prd
 * Loop with: bun run prd:loop
 */

import { execSync } from "child_process";
import { runPrdLoop, type PrdLoopResult } from "gateproof/prd";

const BASE_URL = process.env.BASE_URL || "https://myfilepath.com";

const stories = [
  // ─── Phase 0: Foundation ───
  {
    id: "protocol-schemas",
    title: "Agent protocol Zod schemas compile and validate all event types",
    gateFile: "./gates/protocol.gate.sh",
    phase: 0,
  },
  {
    id: "schema-migration",
    title: "Fresh schema (agentSession + agentNode) generates and applies",
    gateFile: "./gates/schema.gate.sh",
    phase: 0,
  },

  // ─── Phase 1: Session View UI ───
  {
    id: "session-view-renders",
    title: "Session view renders tree + chat panel with demo data",
    gateFile: "./gates/session-view.gate.sh",
    phase: 1,
  },
  {
    id: "tree-navigation",
    title: "Clicking tree nodes switches the chat panel content",
    gateFile: "./gates/tree-nav.gate.sh",
    phase: 1,
  },
  {
    id: "rich-messages",
    title: "All rich message types render (text, tool, command, commit, workers)",
    gateFile: "./gates/rich-messages.gate.sh",
    phase: 1,
  },
  {
    id: "spawn-modal",
    title: "Spawn modal creates child agent nodes in the tree",
    gateFile: "./gates/spawn-modal.gate.sh",
    phase: 1,
  },
  {
    id: "theming",
    title: "Light/dark theme toggle works across all components",
    gateFile: "./gates/theming.gate.sh",
    phase: 1,
  },

  // ─── Phase 2: Backend ───
  {
    id: "session-crud",
    title: "Session + node CRUD endpoints work on new schema",
    gateFile: "./gates/session-crud.gate.sh",
    phase: 2,
  },
  {
    id: "do-relay",
    title: "ChatAgent DO relays messages between WebSocket and container stdin/stdout",
    gateFile: "./gates/do-relay.gate.sh",
    phase: 2,
  },
  {
    id: "container-lifecycle",
    title: "Containers start, receive tasks, emit events, and stop cleanly",
    gateFile: "./gates/container-lifecycle.gate.sh",
    phase: 2,
  },

  // ─── Phase 3: Session Management ───
  {
    id: "dashboard",
    title: "Dashboard lists sessions with status and node counts",
    gateFile: "./gates/dashboard.gate.sh",
    phase: 3,
  },
  {
    id: "session-creation",
    title: "One-click session creation → spawn modal → working session",
    gateFile: "./gates/session-creation.gate.sh",
    phase: 3,
  },

  // ─── Auth (kept from before) ───
  {
    id: "user-signup",
    title: "User can sign up via email/password",
    gateFile: "./gates/signup.gate.sh",
    phase: 0,
  },
  {
    id: "user-login",
    title: "User can log in with email/password",
    gateFile: "./gates/login.gate.sh",
    phase: 0,
  },

  // ─── North Star ───
  {
    id: "north-star",
    title: "E2E: Create session → Spawn agent → Send task → Agent works → See results in chat",
    gateFile: "./gates/north-star.gate.sh",
    phase: 3,
  },
];

// ─── Check for loop mode ───
const loop = process.argv.includes("--loop");

if (loop) {
  console.log("\n  filepath PRD gates (loop mode)\n");
  console.log(`  Target: ${BASE_URL}\n`);

  const result: PrdLoopResult = await runPrdLoop(
    { stories },
    {
      maxIterations: 10,
      onIteration: (status) => {
        console.log(
          `  [${status.attempt}/${status.maxAttempts}] ${status.passed ? "✓ All passed" : `✗ Failed: ${status.failedStory?.id}`}`,
        );
      },
    },
  );

  if (result.success) {
    console.log(`\n  All gates passed after ${result.attempts} attempts!\n`);
    process.exit(0);
  } else {
    console.log(
      `\n  Gates failed after ${result.attempts} attempts. Convergence not reached.\n`,
    );
    process.exit(1);
  }
} else {
  // Single pass — run bash gates directly (gateproof runPrd expects JS modules)
  console.log("\n  filepath PRD gates\n");
  console.log(`  Target: ${BASE_URL}`);
  console.log();

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const story of stories) {
    const exists = (() => {
      try {
        execSync(`test -f ${story.gateFile}`, { stdio: "pipe" });
        return true;
      } catch {
        return false;
      }
    })();

    if (!exists) {
      console.log(`  ~ [${story.id}] ${story.title}`);
      console.log(`    gate not written yet\n`);
      skipped++;
      continue;
    }

    console.log(`  > [${story.id}] ${story.title}`);
    try {
      execSync(`bash ${story.gateFile} ${BASE_URL}`, {
        stdio: "pipe",
        timeout: 30000,
      });
      console.log(`    PASSED\n`);
      passed++;
    } catch {
      console.log(`    FAILED\n`);
      failed++;
    }
  }

  console.log(
    `\n  ${passed} passed, ${failed} failed, ${skipped} pending\n`,
  );
  process.exit(failed === 0 ? 0 : 1);
}
