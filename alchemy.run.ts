import alchemy from "alchemy";
import { SvelteKit, Worker, Container, DurableObjectNamespace } from "alchemy/cloudflare";

const projectName = "filepath";

const project = await alchemy(projectName, {
  password: process.env.ALCHEMY_PASSWORD || "default-password"
});

// Sandbox Container (uses base cloudflare/sandbox image)
// Using 'basic' instance type (1 GiB memory) instead of default 'lite' (256 MiB)
// to support ttyd + bash + all pre-installed agents
const Sandbox = await Container(`${projectName}-sandbox`, {
  className: "Sandbox",
  scriptName: `${projectName}-worker`,
  adopt: true,
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

// Create the worker with Hono API
export const WORKER = await Worker(`${projectName}-worker`, {
  name: `${projectName}-worker`,
  entrypoint: "./worker/index.ts",
  domains: ["api.myfilepath.com"],
  routes: ["api.myfilepath.com/*"],
  adopt: true,
  url: false,
  bindings: {
    Sandbox,
    SessionState,
    TabState,
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
  routes: ["myfilepath.com/*"],
  bindings: {
    WORKER
  },
  url: false,
  adopt: true,
});

await project.finalize();

console.log(`🚀 Worker deployed at: ${WORKER.url}`);
console.log(`🚀 App deployed at: ${APP.url}`);
console.log(`🚀 Sandbox deployed at: ${Sandbox.scriptName}`);
