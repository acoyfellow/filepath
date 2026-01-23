import alchemy from "alchemy";
import { Worker, Container } from "alchemy/cloudflare";

const project = await alchemy("terminal-app", {
  password: process.env.ALCHEMY_PASSWORD || "default-password",
});

// Sandbox Container (uses base cloudflare/sandbox image from Dockerfile)
const Sandbox = await Container("sandbox", {
  className: "Sandbox",
  scriptName: "worker",
  build: {
    dockerfile: "Dockerfile",
    context: ".",
    platform: "linux/amd64",
  },
  instanceType: "basic", // 1 GiB memory, 1/4 vCPU, 4 GB disk
});

export const WORKER = await Worker("worker", {
  entrypoint: "./worker/index.ts",
  bindings: { Sandbox },
});

await project.finalize();

