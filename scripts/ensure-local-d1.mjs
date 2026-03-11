import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const WORKSPACE = process.cwd();
const ALCHEMY_ROOT = join(WORKSPACE, ".alchemy", "filepath");
const MIGRATIONS_DIR = join(WORKSPACE, "migrations");
const ALCHEMY_LOCAL_MIGRATIONS_MODULE = pathToFileURL(
  join(WORKSPACE, "node_modules", "alchemy", "lib", "cloudflare", "d1-local-migrations.js"),
).href;

function findDbStateFile(root) {
  if (!existsSync(root)) {
    return null;
  }

  for (const scope of readdirSync(root)) {
    const scopeDir = join(root, scope);
    try {
      for (const entry of readdirSync(scopeDir)) {
        if (entry.endsWith("-db.json")) {
          return join(scopeDir, entry);
        }
      }
    } catch {
      // Ignore partially-created scope directories.
    }
  }

  return null;
}

function readSqlFile(filePath) {
  return readFileSync(filePath, "utf8");
}

const stateFile = findDbStateFile(ALCHEMY_ROOT);
if (!stateFile) {
  console.log("Skipping local D1 bootstrap: no Alchemy database state found yet.");
  process.exit(0);
}

const state = JSON.parse(readFileSync(stateFile, "utf8"));
const output = state.output ?? {};
const props = state.props ?? {};
const databaseId = output.dev?.id || output.name;
const migrationsTable = output.migrationsTable || "d1_migrations";
const migrationEntries = Array.isArray(props.migrationsFiles) ? props.migrationsFiles : [];

if (!databaseId || migrationEntries.length === 0) {
  console.log("Skipping local D1 bootstrap: missing database id or migrations.");
  process.exit(0);
}

const { applyLocalD1Migrations } = await import(ALCHEMY_LOCAL_MIGRATIONS_MODULE);

await applyLocalD1Migrations({
  rootDir: resolve(WORKSPACE),
  databaseId,
  migrationsTable,
  migrations: migrationEntries.map((entry) => ({
    id: entry.id,
    sql: readSqlFile(join(MIGRATIONS_DIR, entry.id)),
  })),
  imports: [],
});

console.log(`Local D1 ready: ${databaseId}`);
