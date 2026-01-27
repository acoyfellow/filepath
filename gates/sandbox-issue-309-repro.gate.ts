import { Gate, Act, Assert, createEmptyObserveResource } from "gateproof";

const result = await Gate.run({
  name: "sandbox-issue-309-repro",
  observe: createEmptyObserveResource(),
  act: [
    Act.exec("bun run gates/_checks/file-exists.ts repro-sandbox-309-minimal/src/index.ts"),
    Act.exec(
      "bun run gates/_checks/file-contains.ts repro-sandbox-309-minimal/src/index.ts spawn --version"
    ),
    Act.exec(
      "bun run gates/_checks/file-contains.ts repro-sandbox-309-minimal/README.md /spawn-test /agent-sdk-test"
    ),
  ],
  assert: [Assert.noErrors()],
  report: "pretty",
});

if (result.status !== "success") {
  process.exit(1);
}
