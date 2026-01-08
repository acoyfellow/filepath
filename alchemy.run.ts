import alchemy from "alchemy";
import { Worker, Container } from "alchemy/cloudflare";

const project = await alchemy("filepath-terminal", {
  password: process.env.ALCHEMY_PASSWORD || "default-password",
});

const Sandbox = await Container("sandbox", {
  className: "Sandbox",
  scriptName: "worker",
  build: {
    dockerfile: "Dockerfile",
    context: ".",
    platform: "linux/amd64",
  },
  instanceType: "basic",
});

export const WORKER = await Worker("worker", {
  entrypoint: "./worker/index.ts",
  routes: [{ pattern: "api.myfilepath.com/*", adopt: true }],
  bindings: { Sandbox },
});

await project.finalize();

console.log({
  WORKER: WORKER.url
})