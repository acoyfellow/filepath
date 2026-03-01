#!/usr/bin/env bun
/**
 * filepath PRD -- Gate-driven development
 *
 * Run with: bun run prd
 * Loop with: bun run prd:loop
 */

import { execSync } from "child_process";

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

type RunSummary = {
  success: boolean;
  passed: number;
  failed: number;
  skipped: number;
  failedStory?: (typeof stories)[number];
};

function gateExists(path: string) {
  try {
    execSync(`test -f ${path}`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function runGate(gateFile: string) {
  execSync(`bash ${gateFile} ${BASE_URL}`, {
    stdio: "pipe",
    timeout: 30000,
  });
}

function runOnce(logOutput = true): RunSummary {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let failedStory: (typeof stories)[number] | undefined;

  for (const story of stories) {
    const exists = gateExists(story.gateFile);

    if (!exists) {
      if (logOutput) {
        console.log(`  ~ [${story.id}] ${story.title}`);
        console.log(`    gate not written yet\n`);
      }
      skipped++;
      continue;
    }

    if (logOutput) {
      console.log(`  > [${story.id}] ${story.title}`);
    }

    try {
      runGate(story.gateFile);
      if (logOutput) {
        console.log(`    PASSED\n`);
      }
      passed++;
    } catch {
      if (!failedStory) {
        failedStory = story;
      }
      if (logOutput) {
        console.log(`    FAILED\n`);
      }
      failed++;
    }
  }

  return {
    success: failed === 0,
    passed,
    failed,
    skipped,
    failedStory,
  };
}

if (loop) {
  console.log("\n  filepath PRD gates (loop mode)\n");
  console.log(`  Target: ${BASE_URL}\n`);

  const maxIterations = 10;
  let attempts = 0;
  let last = runOnce(false);

  while (attempts < maxIterations) {
    attempts += 1;
    last = runOnce(false);
    console.log(
      `  [${attempts}/${maxIterations}] ${last.success ? "✓ All passed" : `✗ Failed: ${last.failedStory?.id}`}`,
    );
    if (last.success) break;
  }

  if (last.success) {
    console.log(`\n  All gates passed after ${attempts} attempts!\n`);
    process.exit(0);
  } else {
    console.log(`\n  Gates failed after ${attempts} attempts. Convergence not reached.\n`);
    process.exit(1);
  }
} else {
  // Single pass — run bash gates directly (gateproof runPrd expects JS modules)
  console.log("\n  filepath PRD gates\n");
  console.log(`  Target: ${BASE_URL}`);
  console.log();

  const result = runOnce(true);

  console.log(
    `\n  ${result.passed} passed, ${result.failed} failed, ${result.skipped} pending\n`,
  );
  process.exit(result.success ? 0 : 1);
}
