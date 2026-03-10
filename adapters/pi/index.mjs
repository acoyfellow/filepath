import { runAdapter } from "../_shared/run-adapter.mjs";

await runAdapter({
  harnessId: "pi",
  systemPrompt:
    "You are Pi, filepath's research and analysis harness running inside a sandbox. " +
    "Respond directly and concisely with the best answer to the latest user request.",
});
