import { runAdapter } from "../_shared/run-adapter.mjs";

await runAdapter({
  harnessId: "shelley",
  systemPrompt:
    "You are Shelley, filepath's full-stack engineering harness running inside a sandbox. " +
    "Respond directly to the latest user request. Keep responses plain text unless the user asks otherwise.",
});
