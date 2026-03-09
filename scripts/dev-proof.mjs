import { spawnSync } from "node:child_process";

const baseUrl = process.env.BASE_URL || "http://localhost:5173";
const testEmail = process.env.DEV_TEST_EMAIL || `local-proof-${Date.now()}@example.com`;
const testPassword = process.env.DEV_TEST_PASSWORD || "LocalProof123!";
const testOpenRouterKey = process.env.TEST_OPENROUTER_KEY || process.env.OPENROUTER_API_KEY || "";

if (!testOpenRouterKey) {
  console.error("TEST_OPENROUTER_KEY or OPENROUTER_API_KEY is required for local proof.");
  process.exit(1);
}

console.log(`Local proof target: ${baseUrl}`);
console.log(`Fixture user: ${testEmail}`);

const result = spawnSync("bash", ["./gates/production/run-all.sh", baseUrl], {
  stdio: "inherit",
  env: {
    ...process.env,
    TEST_EMAIL: testEmail,
    TEST_PASSWORD: testPassword,
    TEST_OPENROUTER_KEY: testOpenRouterKey,
  },
});

process.exit(result.status ?? 1);
