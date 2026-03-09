import alchemy from "alchemy";

import {
  SvelteKit,
  Worker,
  DurableObjectNamespace,
  Container,
  D1Database,
} from "alchemy/cloudflare";

import { CloudflareStateStore, FileSystemStateStore } from "alchemy/state";

import type { ChatAgent } from "./src/agent/chat-agent.ts";

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

// Chat Agent Durable Object (relay between frontend and container)
const CHAT_AGENT_DO = DurableObjectNamespace<ChatAgent>(`${projectName}-chat-agent`, {
  className: "ChatAgent",
  scriptName: `${prefix}-worker`,
  sqlite: true
});

// Session DO (session event fan-out)
const SESSION_DO = DurableObjectNamespace(`${projectName}-session-do`, {
  className: "SessionEventBusV2",
  scriptName: `${prefix}-worker`,
});

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
  adopt: true,
  build: {
    context: ".",
    dockerfile: "Dockerfile",
    platform: "linux/amd64",
  },
  instanceType: "standard",
  maxInstances: 15,
});

// Worker using Agents SDK
export const WORKER = await Worker(`${projectName}-worker`, {
  name: `${prefix}-worker`,
  entrypoint: "./worker/agent.ts",
  compatibilityDate: "2025-11-15",
  compatibilityFlags: ["nodejs_compat", "experimental"],
  adopt: true,
  bundle: {
  },
  bindings: {
    ChatAgent: CHAT_AGENT_DO,
    SESSION_DO,
    Sandbox,
    DB,

  },
  domains: isProd ? ["api.myfilepath.com"] : [],
  url: true,
  observability: {
    enabled: true,
  },
  env: {
    API_WS_HOST: isProd ? "api.myfilepath.com" : "",
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || "",
    BETTER_AUTH_URL: isProd ? "https://myfilepath.com" : "http://localhost:5173",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
    OPENCODE_ZEN_API_KEY: process.env.OPENCODE_ZEN_API_KEY || "",
    // OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "", // BYOK: Users provide via Settings → API Keys
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || "",
  },
});

const workerUrl = isProd ? "https://api.myfilepath.com" : WORKER.url;

// SvelteKit app with custom routing for agent and session websockets
export const APP = await SvelteKit(`${projectName}-app`, {
  name: `${prefix}-app`,
  domains: isProd ? ["myfilepath.com"] : [],
  bindings: {
    WORKER,
    ChatAgent: CHAT_AGENT_DO,
    DB,
    SESSION_DO,
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
    API_WS_ORIGIN: workerUrl,
    MAILGUN_API_KEY: process.env.MAILGUN_API_KEY || '',
    MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN || '',
  },
  script: `
    import svelteKitHandler from './.svelte-kit/cloudflare/_worker.js';
    
    export default {
      async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (url.pathname.startsWith('/agents/')) {
          return env.WORKER.fetch(request);
        }

        if (url.pathname.startsWith('/session-events/')) {
          return env.WORKER.fetch(request);
        }

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
