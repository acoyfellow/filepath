import alchemy from "alchemy";

import {
  DurableObjectNamespace,
  SvelteKit,
  Worker,
  Container,
  D1Database,
  EmailSender,
} from "alchemy/cloudflare";

import { CloudflareStateStore, FileSystemStateStore } from "alchemy/state";

for (const envFile of [".env", ".env.local"]) {
  try {
    process.loadEnvFile?.(envFile);
  } catch {
    // Local env files are optional.
  }
}

const password = process.env.ALCHEMY_PASSWORD;
if (!password) {
  throw new Error("Missing ALCHEMY_PASSWORD for Alchemy secrets.");
}

const projectName = "filepath";

const app = await alchemy(projectName, {
  password,
  stateStore: (scope) =>
    scope.local
      ? new FileSystemStateStore(scope)
      : new CloudflareStateStore(scope, { forceUpdate: true }),
});

// Use stable per-stage names. Prod can be recreated freely right now, so do not
// adopt the legacy D1 database that predates migrations.
const isProd = app.stage === "prod";
const prefix = isProd ? projectName : `${app.stage}-${projectName}`;
const dbName = isProd ? `${projectName}-db` : `${prefix}-db`;

console.log(`Stage: ${app.stage}, isProd: ${isProd}, prefix: ${prefix}`);

// D1 database for auth + metadata.
// Local dev uses a local D1 file. CI previews get isolated disposable DBs.
// Production uses a fresh managed database instead of adopting the old legacy DB.
const DB = await D1Database(dbName, {
  name: dbName,
  migrationsDir: "./migrations",
  adopt: false,
  dev: { remote: false },
});

// Platform set to linux/amd64 because Cloudflare sandbox image only supports AMD64
const Sandbox = await Container(`${projectName}-sandbox`, {
  className: "Sandbox",
  scriptName: `${prefix}-worker`,
  adopt: true,
  build: {
    context: ".",
    dockerfile: "Dockerfile",
    platform: "linux/amd64",
  },
  instanceType: "standard",
  maxInstances: 15,
});

const ConversationAgentDO = DurableObjectNamespace("ConversationAgent", {
  className: "ConversationAgent",
  sqlite: true,
});

const MCPAgentDO = DurableObjectNamespace("MCPAgent", {
  className: "MCPAgent",
  sqlite: true,
});

// Worker
export const WORKER = await Worker(`${projectName}-worker`, {
  name: `${prefix}-worker`,
  entrypoint: "./worker/agent.ts",
  compatibilityDate: "2025-11-15",
  compatibilityFlags: ["nodejs_compat"],
  adopt: true,
  bundle: {},
  bindings: {
    Sandbox,
    DB,
    ConversationAgent: ConversationAgentDO,
    MCPAgent: MCPAgentDO,
  },
  domains: isProd ? ["api.myfilepath.com"] : [],
  url: true,
  observability: {
    enabled: true,
  },
  env: {
    API_WS_HOST: isProd ? "api.myfilepath.com" : "",
    FILEPATH_RUNTIME_PUBLIC_BASE_URL: isProd ? "https://api.myfilepath.com" : "",
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || "",
    BETTER_AUTH_URL: isProd ? "https://myfilepath.com" : "http://localhost:5173",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
    // Inference providers are BYOK per-user via /settings/ai — no system-wide env vars.
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || "",
  },
});

// Cloudflare Email Sending binding — `env.EMAIL.send({to, from, subject, html, text})`.
// One-time dashboard step: Compute → Email Service → Email Sending → Onboard myfilepath.com
// (alchemy doesn't model the account-level enablement yet; DNS records are managed by CF).
const EMAIL = EmailSender({
  allowedSenderAddresses: ["noreply@myfilepath.com", "support@myfilepath.com"],
  dev: { remote: true },
});

export const APP = await SvelteKit(`${projectName}-app`, {
  name: `${prefix}-app`,
  domains: isProd ? ["myfilepath.com"] : [],
  bindings: {
    WORKER,
    Sandbox,
    DB,
    EMAIL,
  },
  url: true,
  adopt: true,
  env: {
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || (() => {
      throw new Error("BETTER_AUTH_SECRET required");
    })(),
    BETTER_AUTH_URL: isProd
      ? "https://myfilepath.com"
      : process.env.BETTER_AUTH_URL || "http://localhost:5173",
  },
  script: `
    import svelteKitHandler from './.svelte-kit/cloudflare/_worker.js';
    
    export default {
      async fetch(request, env, ctx) {
        return svelteKitHandler.fetch(request, env, ctx);
      }
    };
  `,
});

await app.finalize();

console.log(`\n✅ ${projectName} deployed`);
console.log(`   App: ${APP.url}`);
if (isProd) {
  console.log(`   Domain: https://myfilepath.com`);
}
