import alchemy from "alchemy";
import { Assets, Container, Vite, Worker } from "alchemy/cloudflare";

const password = process.env.ALCHEMY_PASSWORD;
if (!password) {
  throw new Error("Missing ALCHEMY_PASSWORD for Alchemy secrets.");
}

const app = await alchemy("filepath", { password });

const assets = await Assets({
  path: "./public",
});

export const website = await Vite("filepath-web", {
  name: "filepath-web",
});

const sandbox = await Container("sandbox", {
  className: "Sandbox",
  build: {
    context: ".",
    dockerfile: "Dockerfile",
  },
  instanceType: "lite",
  maxInstances: 1,
});

export const worker = await Worker("filepath", {
  name: "filepath",
  entrypoint: "./src/index.ts",
  compatibilityDate: "2025-11-15",
  compatibilityFlags: ["nodejs_compat"],
  observability: {
    enabled: true,
  },
  bindings: {
    ASSETS: assets,
    Sandbox: sandbox,
    OPENAI_API_KEY: alchemy.secret(process.env.OPENAI_API_KEY ?? ""),
  },
});

await app.finalize();
