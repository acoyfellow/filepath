/**
 * One-off: clear stale D1 state from Alchemy's CloudflareStateStore.
 * Use when you manually deleted the D1 DB but Alchemy state still references the old UUID.
 *
 * Run: NODE_ENV=production bunx alchemy destroy --stage prod alchemy.state-clear-d1.ts
 *
 * Then deploy normally; Alchemy will create a fresh D1.
 */
process.env.ALCHEMY_D1_SKIP_DELETE_API = "1";
import alchemy from "alchemy";
import { D1Database } from "alchemy/cloudflare";
import { CloudflareStateStore, FileSystemStateStore } from "alchemy/state";

for (const f of [".env", ".env.local"]) {
  try {
    process.loadEnvFile?.(f);
  } catch {}
}

const password = process.env.ALCHEMY_PASSWORD;
if (!password) {
  throw new Error("Missing ALCHEMY_PASSWORD");
}

const projectName = "filepath";
const app = await alchemy(projectName, {
  password,
  stateStore: (scope) =>
    scope.local
      ? new FileSystemStateStore(scope)
      : new CloudflareStateStore(scope, { forceUpdate: true }),
});

const isProd = app.stage === "prod";
const dbName = isProd ? `${projectName}-db` : `${app.stage}-${projectName}-db`;

await D1Database(dbName, {
  name: dbName,
  migrationsDir: "./migrations",
  adopt: false,
  dev: { remote: false },
});

await app.finalize();
console.log("State cleared for filepath-db. Deploy normally to create fresh D1.");
