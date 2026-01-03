import alchemy from "alchemy";
import { SvelteKit, Worker, Container, DurableObjectNamespace, CustomDomain } from "alchemy/cloudflare";

import { CloudflareStateStore } from "alchemy/state";

const projectName = "filepath";

const project = await alchemy(projectName, {
  password: process.env.ALCHEMY_PASSWORD || "default-password",
  stateStore: !process.env.CI ? undefined : (scope) => new CloudflareStateStore(scope, {
    scriptName: `${projectName}-state`,
    email: process.env.CLOUDFLARE_EMAIL || "default-email",
    apiToken: alchemy.secret(process.env.CLOUDFLARE_API_KEY || "default-api-key"),
    stateToken: alchemy.secret(process.env.ALCHEMY_STATE_TOKEN || "default-state-token"),
    forceUpdate: true
  })
});

// Sandbox Container (uses base cloudflare/sandbox image)
// Using 'basic' instance type (1 GiB memory) instead of default 'lite' (256 MiB)
// to support ttyd + bash + all pre-installed agents
const Sandbox = await Container(`${projectName}-sandbox`, {
  className: "Sandbox",
  scriptName: `${projectName}-worker`,
  adopt: true,
  apiKey: process.env.CLOUDFLARE_API_KEY ? alchemy.secret(process.env.CLOUDFLARE_API_KEY) : undefined,
  email: process.env.CLOUDFLARE_EMAIL,
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  build: {
    dockerfile: "Dockerfile",
    context: process.cwd(),
    platform: "linux/amd64",
  },
  instanceType: "basic", // 1 GiB memory, 1/4 vCPU, 4 GB disk
});

// SessionState Durable Object for tab state management
const SessionState = DurableObjectNamespace(`${projectName}-session-state`, {
  className: "SessionStateDO",
  scriptName: `${projectName}-worker`,
  sqlite: true,
});

// TabState Durable Object for per-tab state
const TabState = DurableObjectNamespace(`${projectName}-tab-state`, {
  className: "TabStateDO",
  scriptName: `${projectName}-worker`,
  sqlite: true,
});

// TabBroadcast Durable Object for WebSocket broadcasting per tab
const TabBroadcast = DurableObjectNamespace(`${projectName}-tab-broadcast`, {
  className: "TabBroadcastDO",
  scriptName: `${projectName}-worker`,
});

// Create the worker with Hono API
export const WORKER = await Worker(`${projectName}-worker`, {
  name: `${projectName}-worker`,
  entrypoint: "./worker/index.ts",
  // domains: ["api.myfilepath.com"],
  routes: [{ pattern: "api.myfilepath.com/*", adopt: true }],
  url: false,
  adopt: true,
  apiKey: process.env.CLOUDFLARE_API_KEY ? alchemy.secret(process.env.CLOUDFLARE_API_KEY) : undefined,
  email: process.env.CLOUDFLARE_EMAIL,
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  bindings: {
    Sandbox,
    SessionState,
    TabState,
    TabBroadcast,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
    CURSOR_API_KEY: process.env.CURSOR_API_KEY || "",
    FACTORY_API_KEY: process.env.FACTORY_API_KEY || "",
  }
});

// Create the SvelteKit app
export const APP = await SvelteKit(`${projectName}-app`, {
  name: `${projectName}-app`,
  domains: ["myfilepath.com"],
  // routes: [{ pattern: "myfilepath.com/*", adopt: true }],
  bindings: {
    WORKER
  },
  url: true,
  adopt: true,
});

await project.finalize();

console.log(`🚀 Worker deployed at: ${WORKER.url}`);
console.log(`🚀 App deployed at: ${APP.url}`);
console.log(`🚀 Sandbox deployed at: ${Sandbox.scriptName}`);
