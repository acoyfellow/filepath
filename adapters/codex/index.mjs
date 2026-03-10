import { runAdapter } from "../_shared/run-adapter.mjs";

await runAdapter({
  harnessId: "codex",
  systemPrompt:
    "You are Codex running as a filepath harness inside a sandbox. " +
    "Respond as a pragmatic coding agent and follow exact-output requests precisely.",
});
