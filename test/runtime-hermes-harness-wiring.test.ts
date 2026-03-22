import { describe, expect, test } from "bun:test";
import { encryptApiKey } from "../src/lib/crypto";
import { loadAgentExecutionConfig } from "../src/lib/runtime/agent-runtime";

const TEST_SECRET = "test-secret-for-hermes-harness-wiring";

function createMockDB(row: Record<string, unknown>) {
  return {
    prepare: (/* sql */) => ({
      bind: (/* ..._args */) => ({
        first: () => Promise.resolve(row),
        all: () => Promise.resolve({ results: [row] }),
        run: () => Promise.resolve({ meta: {} }),
      }),
    }),
  };
}

describe("runtime hermes harness wiring", () => {
  test("loadAgentExecutionConfig loads Hermes harness when entry_command is set", async () => {
    const encryptedKeys = await encryptApiKey(
      JSON.stringify({ openrouter: "sk-or-test-placeholder" }),
      TEST_SECRET,
    );

    const mockDB = createMockDB({
      harness_id: "hermes",
      model: "anthropic/claude-sonnet-4",
      allowed_paths: '["."]',
      forbidden_paths: "[]",
      tool_permissions: '["read","write"]',
      writable_root: null,
      workspace_id: "ws-1",
      initial_source_url: null,
      user_key: encryptedKeys,
      entry_command: "node /opt/filepath/adapters/hermes/index.mjs",
    });

    const env = {
      DB: mockDB as never,
      BETTER_AUTH_SECRET: TEST_SECRET,
    };

    await expect(
      loadAgentExecutionConfig(env as never, "agent-1", "ws-1", "Test task"),
    ).resolves.toMatchObject({
      harnessId: "hermes",
      entryCommand: "node /opt/filepath/adapters/hermes/index.mjs",
    });
  });
});
