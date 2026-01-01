import alchemy from "alchemy";
import { SvelteKit, Worker, Container, DurableObjectNamespace } from "alchemy/cloudflare";

const projectName = "filepath";

const project = await alchemy(projectName, {
  password: process.env.ALCHEMY_PASSWORD || "default-password"
});

// Sandbox Container (uses base cloudflare/sandbox image)
const Sandbox = await Container(`${projectName}-sandbox`, {
  className: "Sandbox",
  scriptName: `${projectName}-worker`,
  build: {
    dockerfile: "Dockerfile",
    context: process.cwd(),
    platform: "linux/amd64",
  },
});

// SessionState Durable Object for tab state management
const SessionState = DurableObjectNamespace(`${projectName}-session-state`, {
  className: "SessionStateDO",
  scriptName: `${projectName}-worker`,
  sqlite: true,
});

// TabState Durable Object for per-tab state management
const TabState = DurableObjectNamespace(`${projectName}-tab-state`, {
  className: "TabStateDO",
  scriptName: `${projectName}-worker`,
  sqlite: true,
});

// Create the worker with Hono API
export const WORKER = await Worker(`${projectName}-worker`, {
  name: `${projectName}-worker`,
  entrypoint: "./worker/index.ts",
  adopt: true,
  bindings: {
    Sandbox,
    SessionState,
    TabState,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
    CURSOR_API_KEY: process.env.CURSOR_API_KEY || "",
    FACTORY_API_KEY: process.env.FACTORY_API_KEY || "",
  },
  url: false,
  env: {

  }
});

// Create the SvelteKit app
export const APP = await SvelteKit(`${projectName}-app`, {
  name: `${projectName}-app`,
  bindings: {
    WORKER, // Service binding to worker
  },
  url: true,
  adopt: true,
});

await project.finalize();

console.log(`🚀 Worker deployed at: ${WORKER.url}`);
console.log(`🚀 App deployed at: ${APP.url}`);
console.log(`🚀 Sandbox deployed at: ${Sandbox.scriptName}`);
