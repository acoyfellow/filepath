// Example usage of wrangler-harness
// This example dog-foods the library by using it to test itself
import { Gate, Act, Observe, Assert, Stop, Report } from "./src/index";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || "bfcb6ac5b3ceaf42a09607f6f7925823";
const workerName = process.argv[2] || "filepath-sandbox";
const testUrl = process.argv[3] || `https://${workerName}.coy.workers.dev/`;

console.log(`🔍 Running E2E test with wrangler-harness`);
console.log(`Worker: ${workerName}`);
console.log(`URL: ${testUrl}\n`);

const gate = Gate.define({
  name: "smoke-test",
  target: {
    accountId,
    workerName
  },
  act: Act.sequence([
    Act.browser({ 
      url: testUrl, 
      headless: false, 
      waitMs: 5000 
    })
  ]),
  observe: Observe.auto({
    accountId,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    dataset: "worker_logs"
  }),
  assert: [
    Assert.noTaggedErrors()
  ],
  stop: Stop.whenIdle({ idleMs: 3000, maxMs: 10000 }),
  report: Report.pretty()
});

Gate.run(gate).then((res) => {
  console.log(`\n✅ Test completed with status: ${res.status}`);
  if (res.status !== "success") {
    console.error(`\n❌ Test failed. Error: ${res.error?._tag}`);
    process.exit(1);
  }
  process.exit(0);
}).catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
