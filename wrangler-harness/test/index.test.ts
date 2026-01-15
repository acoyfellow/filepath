import { describe, test, expect } from "bun:test";
import { Gate, Act, Observe, Assert, Stop, Report } from "../src/index";

describe("wrangler-harness", () => {
  test("Gate.define creates a spec", () => {
    const spec = Gate.define({
      name: "test",
      target: { workerName: "test-worker" },
      act: [],
      observe: Observe.cliStream({}),
      assert: [],
      stop: Stop.whenIdle({ idleMs: 1000, maxMs: 5000 }),
      report: Report.json()
    });

    expect(spec.name).toBe("test");
    expect(spec.target.workerName).toBe("test-worker");
  });

  test("Act helpers create correct steps", () => {
    const exec = Act.exec("wrangler deploy");
    expect(exec._tag).toBe("Exec");
    if (exec._tag === "Exec") {
      expect(exec.command).toBe("wrangler deploy");
    }

    const wait = Act.wait(5000);
    expect(wait._tag).toBe("Wait");
    if (wait._tag === "Wait") {
      expect(wait.ms).toBe(5000);
    }

    const browser = Act.browser({ url: "https://example.com", headless: true });
    expect(browser._tag).toBe("Browser");
    if (browser._tag === "Browser") {
      expect(browser.url).toBe("https://example.com");
      expect(browser.headless).toBe(true);
    }
  });

  test("Assert helpers create correct assertions", () => {
    const noErrors = Assert.noTaggedErrors();
    expect(noErrors._tag).toBe("NoTaggedErrors");

    const required = Assert.requiredActions(["test_action"]);
    expect(required._tag).toBe("RequiredActions");
    if (required._tag === "RequiredActions") {
      expect(required.actions).toEqual(["test_action"]);
    }
  });

  test("Stop.whenIdle creates correct policy", () => {
    const policy = Stop.whenIdle({ idleMs: 3000, maxMs: 15000 });
    expect(policy._tag).toBe("WhenIdle");
    expect(policy.idleMs).toBe(3000);
    expect(policy.maxMs).toBe(15000);
  });

  test("Report helpers create correct reporters", () => {
    const json = Report.json({ pretty: true });
    expect(json._tag).toBe("Json");
    if (json._tag === "Json") {
      expect(json.pretty).toBe(true);
    }

    const pretty = Report.pretty();
    expect(pretty._tag).toBe("Pretty");
  });
});
