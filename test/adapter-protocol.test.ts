import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseAgentEvent } from "../src/lib/protocol";

const HARNESS_IDS = ["shelley", "pi", "claude-code", "codex", "cursor", "amp", "hermes"] as const;

function runAdapter(harnessId: string, task: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "filepath-adapter-test-"));
  const adapterPath = join(process.cwd(), "adapters", harnessId, "index.mjs");

  return new Promise((resolve, reject) => {
    const proc = Bun.spawn(["node", adapterPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        FILEPATH_TASK: task,
        FILEPATH_API_KEY: "sk-test-placeholder",
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
        rmSync(workspaceRoot, { recursive: true, force: true });
        resolve({ stdout, stderr, exitCode: exitCode ?? -1 });
      })
      .catch((err) => {
        rmSync(workspaceRoot, { recursive: true, force: true });
        reject(err);
      });
  });
}

function parseNdjsonLines(stdout: string): Array<ReturnType<typeof parseAgentEvent>> {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseAgentEvent(line));
}

describe("adapter protocol", () => {
  for (const harnessId of HARNESS_IDS) {
    test(`${harnessId} emits valid FAP NDJSON and terminates with done`, async () => {
      const task = "__filepath_local_wait__:250:PROTOCOL_OK";
      const { stdout, stderr, exitCode } = await runAdapter(harnessId, task);

      expect(exitCode).toBe(0);
      expect(stderr).toBe("");

      const parsed = parseNdjsonLines(stdout);
      expect(parsed.length).toBeGreaterThan(0);
      expect(parsed.every((p) => p !== null)).toBe(true);

      const events = parsed.filter((p): p is NonNullable<typeof p> => p !== null);
      const doneEvents = events.filter((e) => e.type === "done");
      expect(doneEvents.length).toBeGreaterThanOrEqual(1);
    });
  }
});
