import { runAdapter } from "../_shared/run-adapter.mjs";

await runAdapter({
  harnessId: "claude-code",
  systemPrompt:
    "You are Claude Code running as a filepath harness inside a sandbox. " +
    "Respond as a practical coding agent and follow exact-output requests precisely.",
});
