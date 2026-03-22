import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseAgentEvent } from "../src/lib/protocol";

const E2E_CONTENT = "E2E_WRITE_TEST_CONTENT";
const WRITE_TASK = `Create or modify allowed/write-test.txt. Write exactly this content: ${E2E_CONTENT}`;

const shouldRunE2E = !!(process.env.FILEPATH_RUN_E2E && process.env.OPENROUTER_API_KEY?.trim());

function runAdapterWriteE2E(harnessId: string): Promise<{ stdout: string; stderr: string; exitCode: number; workspaceRoot: string }> {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "filepath-adapter-e2e-"));
  mkdirSync(join(workspaceRoot, "allowed"), { recursive: true });
  const adapterPath = join(process.cwd(), "adapters", harnessId, "index.mjs");

  return new Promise((resolve, reject) => {
    const proc = Bun.spawn(["node", adapterPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        FILEPATH_TASK: WRITE_TASK,
        FILEPATH_API_KEY: process.env.OPENROUTER_API_KEY || "sk-placeholder",
        FILEPATH_MODEL: "anthropic/claude-sonnet-4",
        FILEPATH_WORKSPACE: workspaceRoot,
        FILEPATH_ALLOWED_PATHS: JSON.stringify(["."]),
        FILEPATH_FORBIDDEN_PATHS: JSON.stringify([".git", "node_modules"]),
      },
      stdout: "pipe",
      stderr: "pipe",
    });

    Promise.all([proc.exited, new Response(proc.stdout).text(), new Response(proc.stderr).text()])
      .then(([exitCode, stdout, stderr]) => {
        resolve({ stdout, stderr, exitCode: exitCode ?? -1, workspaceRoot });
      })
      .catch((err) => {
        rmSync(workspaceRoot, { recursive: true, force: true });
        reject(err);
      });
  });
}

function hasWriteToolEvent(stdout: string): boolean {
  return stdout
    .split(/\r?\n/)
    .map((line) => parseAgentEvent(line))
    .some((e) => {
      if (!e || e.type !== "tool") return false;
      return (e.name === "write_file" || e.name === "replace_text") && e.status === "done";
    });
}

const HARNESS_IDS = ["shelley", "pi", "claude-code", "codex", "cursor", "amp", "hermes"] as const;

describe("adapter write E2E", () => {
  for (const harnessId of HARNESS_IDS) {
    test.if(shouldRunE2E)(`${harnessId} produces write tool event and file change`, async () => {
      const { stdout, exitCode, workspaceRoot } = await runAdapterWriteE2E(harnessId);
      try {
        expect(exitCode).toBe(0);
        expect(hasWriteToolEvent(stdout)).toBe(true);
        const targetPath = join(workspaceRoot, "allowed", "write-test.txt");
        const content = readFileSync(targetPath, "utf8").trim();
        expect(content).toBe(E2E_CONTENT);
      } finally {
        rmSync(workspaceRoot, { recursive: true, force: true });
      }
    });
  }
});
