import { Gate, Act, Assert, createEmptyObserveResource } from "gateproof";

const result = await Gate.run({
  name: "prod-shell-recovery",
  observe: createEmptyObserveResource(),
  act: [
    Act.exec("curl -sSfI https://myfilepath.com/"),
    Act.exec("curl -sSfI https://api.myfilepath.com/")
  ],
  assert: [Assert.noErrors()],
  report: "pretty"
});

if (result.status !== "success") {
  process.exit(1);
}
