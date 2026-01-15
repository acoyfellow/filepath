// Dog-food test: Use wrangler-harness to test itself
import { describe, test, expect } from "bun:test";
import { Gate, Act, Observe, Assert, Stop, Report } from "../src/index";

describe("dog-food: wrangler-harness tests itself", () => {
  test("can create and run a minimal gate (no wrangler, just wait)", async () => {
    const gate = Gate.define({
      name: "self-test",
      target: { workerName: "test-worker" },
      act: Act.sequence([
        Act.wait(100) // Just wait, no actual wrangler needed
      ]),
      observe: Observe.cliStream({}),
      assert: [],
      stop: Stop.whenIdle({ idleMs: 100, maxMs: 1000 }),
      report: Report.json({ pretty: false })
    });

    // This will succeed because no assertions fail (empty assert array)
    // Wrangler tail may fail to connect, but that's okay - we're just testing the gate runs
    const result = await Gate.run(gate);

    // Should complete (success/timeout/failed all valid)
    expect(["success", "failed", "timeout"]).toContain(result.status);
    expect(result.durationMs).toBeGreaterThan(0);
    expect(result.logs).toBeInstanceOf(Array);
    expect(result.evidence).toBeDefined();
  }, 15000);

  test("Act.wait works correctly", async () => {
    const start = Date.now();
    const gate = Gate.define({
      name: "wait-test",
      target: { workerName: "test" },
      act: Act.sequence([Act.wait(200)]),
      observe: Observe.cliStream({}),
      assert: [],
      stop: Stop.whenIdle({ idleMs: 50, maxMs: 500 }),
      report: Report.json({ pretty: false })
    });

    await Gate.run(gate);
    const duration = Date.now() - start;

    // Should take at least 200ms for the wait
    expect(duration).toBeGreaterThanOrEqual(180);
  }, 5000);
});
