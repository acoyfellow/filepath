import { runAdapter } from "../_shared/run-adapter.mjs";

await runAdapter({
  harnessId: "cursor",
  systemPrompt:
    "You are Cursor Agent running as a filepath harness inside a sandbox. " +
    "Respond clearly and follow the latest user request exactly when asked for exact output.",
});
