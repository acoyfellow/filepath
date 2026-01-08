import alchemy from "alchemy";
import { SvelteKit, Worker, Container } from "alchemy/cloudflare";

const project = await alchemy("filepath-new", {
  password: process.env.ALCHEMY_PASSWORD || "default-password",
});

const Sandbox = await Container("sandbox", {
  className: "Sandbox",
  scriptName: "worker",
  build: { dockerfile: "Dockerfile", context: ".", platform: "linux/amd64" },
  instanceType: "standard-2",
});

export const WORKER = await Worker("worker", {
  entrypoint: "./worker.ts",
  routes: [{ pattern: "api.myfilepath.com/*", adopt: true }],
  bindings: { Sandbox }
});

export const APP = await SvelteKit("app", {
  domains: ["myfilepath.com"],
  bindings: { WORKER },
  url: true,
});

await project.finalize();

console.log(`🚀 Worker deployed at: ${WORKER.url}`);
console.log(`🚀 App deployed at: ${APP.url}`);
console.log(`🚀 Sandbox deployed at: ${Sandbox.url}`);