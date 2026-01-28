import alchemy from "alchemy";
import { Assets, Container, Vite, Worker, WorkerRef } from "alchemy/cloudflare";
import { CloudflareStateStore } from "alchemy/state";

const password = process.env.ALCHEMY_PASSWORD;
if (!password) {
  throw new Error("Missing ALCHEMY_PASSWORD for Alchemy secrets.");
}

const projectName= "filepath";
const isProd = process.env.NODE_ENV === "production";

const app = await alchemy(projectName, { 
  password,
  stateStore: (scope) => new CloudflareStateStore(scope, {
    // Chaning this will cause the state store to be recreated, which will cause the project to be recreated
    scriptName: `${projectName}-app-state`,
    email: process.env.CLOUDFLARE_EMAIL!,
    apiToken: alchemy.secret(process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_KEY || ""),
    stateToken: alchemy.secret(process.env.ALCHEMY_STATE_TOKEN || ""),
    forceUpdate: true
  })
});

const assets = await Assets({
  path: "./public",
});

export const website = await Vite(`${projectName}-app`, {
  name: `${projectName}-app`,
  domains: isProd ? ['myfilepath.com'] : [],
  adopt: true,
  assets: {
    directory: "dist/client",
    run_worker_first: true,
    not_found_handling: "single-page-application"
  },
  bindings: {
    API: WorkerRef({ service: `${projectName}-worker` })
  },
  script: `
    export default {
      async fetch(request, env) {
        const url = new URL(request.url);
        if (
          url.pathname.startsWith("/run") ||
          url.pathname.startsWith("/session") ||
          url.pathname.startsWith("/terminal")
        ) {
          return env.API.fetch(request);
        }
        return env.ASSETS.fetch(request);
      }
    };
  `,
  
});

const sandbox = await Container(`${projectName}-sandbox`, {
  className: "Sandbox",
  build: {
    context: ".",
    dockerfile: "Dockerfile",
  },
  instanceType: "lite",
  maxInstances: 2,
});

export const worker = await Worker(`${projectName}-worker`, {
  name: `${projectName}-worker`,
  entrypoint: "./src/index.ts",
  compatibilityDate: "2025-11-15",
  compatibilityFlags: ["nodejs_compat"],
  adopt: true,
  domains: isProd ? ["api.myfilepath.com"] : [],
  observability: {
    enabled: true,
  },
  bindings: {
    ASSETS: assets,
    Sandbox: sandbox,
    API_WS_HOST: "api.myfilepath.com",
    OPENAI_API_KEY: alchemy.secret(process.env.OPENAI_API_KEY ?? ""),
    OPENCODE_ZEN_API_KEY: alchemy.secret(
      process.env.OPENCODE_ZEN_API_KEY ?? ""
    ),
  },
});

await app.finalize();

console.log(`${projectName} deployed successfully`);

console.log(`${projectName} website: ${website.url}`);
console.log(`${projectName} worker: ${worker.url}`);
console.log(`${projectName} sandbox: ${sandbox.id}`);
