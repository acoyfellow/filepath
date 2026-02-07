import alchemy from "alchemy";

import {
  SvelteKit,
  Worker,
  DurableObjectNamespace,
  // D1Database, // Commented out - using manual binding to avoid state cache issues
  Container,
  Workflow
} from "alchemy/cloudflare";

import { CloudflareStateStore } from "alchemy/state";

import type { TaskAgent } from "./src/agent/index.ts";
import type { ChatAgent } from "./src/agent/chat-agent.ts";

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

// Task Agent Durable Object (Agents SDK)
const TASK_AGENT_DO = DurableObjectNamespace<TaskAgent>(`${projectName}-task-agent`, {
  className: "TaskAgent",
  scriptName: `${prefix}-worker`,
  sqlite: true
});

// Chat Agent Durable Object (AIChatAgent - real LLM conversations)
const CHAT_AGENT_DO = DurableObjectNamespace<ChatAgent>(`${projectName}-chat-agent`, {
  className: "ChatAgent",
  scriptName: `${prefix}-worker`,
  sqlite: true
});

// D1 database for auth + metadata
// Manually created to bypass Alchemy state cache bug
// Database UUID: 11c62299-1d8c-418f-b250-ff2598c699c6
// Migrations applied via: wrangler d1 execute filepath-db --file=migrations/0000_initial_schema.sql --remote
const DB = {
  type: "d1" as const,
  id: "11c62299-1d8c-418f-b250-ff2598c699c6", // Must be the UUID, not the name
  name: "filepath-db",
  dev: {
    id: "11c62299-1d8c-418f-b250-ff2598c699c6",
    remote: true,
  },
  jurisdiction: "us" as const,
} as any;

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

// Workflows for long-running tasks (Agents SDK)
// Workflow names must match exports in worker/agent.ts
const EXECUTE_TASK = Workflow(`${projectName}-execute-task`, {
  className: 'ExecuteTaskWorkflow',
  scriptName: `${prefix}-worker`,
});

const CREATE_SESSION = Workflow(`${projectName}-create-session`, {
  className: 'CreateSessionWorkflow',
  scriptName: `${prefix}-worker`,
});

// Worker using Agents SDK
export const WORKER = await Worker(`${projectName}-worker`, {
  name: `${prefix}-worker`,
  entrypoint: "./worker/agent.ts",
  compatibilityDate: "2025-11-15",
  compatibilityFlags: ["nodejs_compat"],
  adopt: true,
  bundle: {
    // AI SDK is now used directly by ChatAgent — must be bundled
  },
  bindings: {
    TaskAgent: TASK_AGENT_DO,
    ChatAgent: CHAT_AGENT_DO,
    Sandbox,
    DB,
    EXECUTE_TASK,
    CREATE_SESSION,
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
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || "",
  },
});

// SvelteKit app with custom routing for terminal WebSocket
export const APP = await SvelteKit(`${projectName}-app`, {
  name: `${prefix}-app`,
  domains: isProd ? ["myfilepath.com"] : [],
  bindings: {
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
    MAILGUN_API_KEY: process.env.MAILGUN_API_KEY || '',
    MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN || '',
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
  // Custom routing: terminal and session endpoints go to worker
  // This matches the working React version's architecture
  script: `
    import svelteKitHandler from './.svelte-kit/cloudflare/_worker.js';
    
    export default {
      async fetch(request, env, ctx) {
        const url = new URL(request.url);
        
        // SvelteKit handles:
        //   /session/new (wizard page)
        //   /session/{id} (3-panel session view page)
        //   /api/session/multi/* (multi-agent CRUD, start, stop, chat, list)
        //   Everything else not explicitly routed to worker
        if (url.pathname.startsWith('/api/session/multi')) {
          return svelteKitHandler.fetch(request, env, ctx);
        }
        if (url.pathname.startsWith('/session/')) {
          // Check if this is a SvelteKit page route (not a worker API)
          // SvelteKit pages: /session/new, /session/{uuid}
          // Worker routes: none under /session/ (legacy SessionDO was /session/{id}/state etc)
          // Since we use multi-agent API now, let SvelteKit handle all /session/* page routes
          return svelteKitHandler.fetch(request, env, ctx);
        }
        
        // Route /agents/* to worker for Agent SDK WebSocket connections
        if (url.pathname.startsWith('/agents/')) {
          return env.WORKER.fetch(request);
        }
        
        // Route terminal/* and legacy /api/session/* to worker
        // Worker handles: terminal HTML pages, WebSocket, start/close, task execution
        if (
          url.pathname.startsWith('/terminal/') ||
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
