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
  stateStore: (scope) => new CloudflareStateStore(scope, { forceUpdate: true }),
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

// Worker that hosts Durable Objects
export const WORKER = await Worker(`${projectName}-worker`, {
  name: `${prefix}-worker`,
  entrypoint: "./worker/index.ts",
  compatibilityDate: "2025-11-15",
  compatibilityFlags: ["nodejs_compat"],
  adopt: true,
  bindings: {
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
  },
});

// SvelteKit app with custom routing for terminal WebSocket
export const APP = await SvelteKit(`${projectName}-app`, {
  name: `${prefix}-app`,
  domains: isProd ? ["myfilepath.com"] : [],
  bindings: {
    SESSION_DO,
    WORKER,
    DB,
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
  // Custom routing: terminal and session endpoints go to worker
  // This matches the working React version's architecture
  script: `
    import svelteKitHandler from './.svelte-kit/cloudflare/_worker.js';
    
    export default {
      async fetch(request, env, ctx) {
        const url = new URL(request.url);
        
        // Route terminal/*, session/* to worker
        // Worker handles: HTML pages, WebSocket, start/close endpoints, task execution
        if (
          url.pathname.startsWith('/terminal/') ||
          url.pathname.startsWith('/session/') ||
          url.pathname.startsWith('/api/session/')
        ) {
          // Rewrite /api/session/* to /session/* for worker
          if (url.pathname.startsWith('/api/session/')) {
            const newUrl = new URL(request.url);
            newUrl.pathname = url.pathname.replace('/api/session/', '/session/');
            return env.WORKER.fetch(new Request(newUrl, request));
          }
          return env.WORKER.fetch(request);
        }
        
        // Everything else goes to SvelteKit
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
