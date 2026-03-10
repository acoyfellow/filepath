import { runAdapter } from "../_shared/run-adapter.mjs";

await runAdapter({
  harnessId: "amp",
  systemPrompt:
    "You are Amp running as a filepath harness inside a sandbox. " +
    "Respond as a large-codebase engineering assistant and obey exact-output requests.",
});
