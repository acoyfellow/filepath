import { describe, expect, test } from "bun:test";
import { encryptApiKey } from "../src/lib/crypto";
import { loadAgentExecutionConfig } from "../src/lib/runtime/agent-runtime";

const TEST_SECRET = "test-secret-for-custom-harness-wiring";

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

describe("runtime custom harness wiring", () => {
  test("loadAgentExecutionConfig does not throw HARNESS_ENTRY_COMMAND_MISSING for custom harness when entry_command is set", async () => {
    const encryptedKeys = await encryptApiKey(
      JSON.stringify({ openrouter: "sk-or-test-placeholder" }),
      TEST_SECRET,
    );

    const mockDB = createMockDB({
      harness_id: "custom",
      model: "anthropic/claude-sonnet-4",
      allowed_paths: '["."]',
      forbidden_paths: "[]",
      tool_permissions: '["read","write"]',
      writable_root: null,
      workspace_id: "ws-1",
      initial_source_url: null,
      user_key: encryptedKeys,
      entry_command: "node /opt/filepath/adapters/custom/index.mjs",
    });

    const env = {
      DB: mockDB as never,
      BETTER_AUTH_SECRET: TEST_SECRET,
    };

    await expect(
      loadAgentExecutionConfig(env as never, "agent-1", "ws-1", "Test task"),
    ).resolves.toMatchObject({
      harnessId: "custom",
      entryCommand: "node /opt/filepath/adapters/custom/index.mjs",
    });
  });
});
