import alchemy from "alchemy";

import {
  SvelteKit,
  Worker,
  DurableObjectNamespace,
  D1Database,
  Container
} from "alchemy/cloudflare";

import { CloudflareStateStore } from "alchemy/state";

import type { SessionDO } from "./worker/index.ts";

const password = process.env.ALCHEMY_PASSWORD;
if (!password) {
  throw new Error("Missing ALCHEMY_PASSWORD for Alchemy secrets.");
}

const projectName = "filepath";

const app = await alchemy(projectName, {
  password,
  stateStore: (scope) => new CloudflareStateStore(scope),
});

// For prod: use fixed names (protect existing resources)
// For previews (pr-123): use stage-scoped names (isolated, disposable)
const isProd = app.stage === "prod";
const prefix = isProd ? projectName : `${app.stage}-${projectName}`;

console.log(`Stage: ${app.stage}, isProd: ${isProd}, prefix: ${prefix}`);

// Durable Object for session state
const SESSION_DO = DurableObjectNamespace<SessionDO>(`${projectName}-session-do`, {
  className: "SessionDO",
  scriptName: `${prefix}-worker`,
  sqlite: true
});

// D1 database for auth + metadata
const DB = await D1Database(`${projectName}-db`, {
  name: `${prefix}-db`,
  migrationsDir: "migrations",
  adopt: true,
});

// Container for terminal sandboxes
const Sandbox = await Container(`${projectName}-sandbox`, {
  className: "Sandbox",
  adopt: true,
  build: {
    context: ".",
    dockerfile: "Dockerfile",
  },
  instanceType: "standard",
  maxInstances: 15,
});

// Worker that hosts Durable Objects
export const WORKER = await Worker(`${projectName}-worker`, {
  name: `${prefix}-worker`,
  entrypoint: "./worker/index.ts",
  adopt: true,
  bindings: {
    SESSION_DO,
    Sandbox,
  },
  url: false
});

// SvelteKit app
export const APP = await SvelteKit(`${projectName}-app`, {
  name: `${prefix}-app`,
  domains: isProd ? ["myfilepath.com"] : [],
  bindings: {
    SESSION_DO,
    WORKER,
    DB,
    Sandbox,
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
  }
});

await app.finalize();

console.log(`\n✅ ${projectName} deployed`);
console.log(`   App: ${APP.url}`);
if (isProd) {
  console.log(`   Domain: https://myfilepath.com`);
}
