import { definePrd, runPrd } from "gateproof/prd";

/**
 * myfilepath.com - The platform for agents
 * 
 * Checkpoints:
 * 1. Terminal Parity ✅ - SvelteKit + better-auth + Containers working
 * 2. Agent Auth 🚧 - API keys for agents, environment secrets
 * 3. Persistence - Sessions forever, real-time sync
 * 4. Billing - Per-minute compute billing
 */

export const prd = definePrd({
  progressLog: [
    "2026-01-31: Checkpoint 1 complete - terminal parity achieved",
    "2026-01-31: shadcn-svelte installed, API keys UI created",
    "2026-01-31: Clean slate DB schema with better-auth apiKey plugin",
  ],
  stories: [
    // ============================================================
    // CHECKPOINT 1: Terminal Parity ✅
    // ============================================================
    {
      id: "terminal-start",
      title: "Terminal containers start via /terminal/{sessionId}/{tabId}/start",
      gateFile: "./gates/terminal-start.gate.ts",
      progress: ["DONE"],
    },
    {
      id: "terminal-websocket",
      title: "Terminal WebSocket connects and receives shell output",
      gateFile: "./gates/terminal-websocket.gate.ts",
      dependsOn: ["terminal-start"],
      progress: ["DONE"],
    },
    {
      id: "session-state",
      title: "Session state persists via Durable Objects",
      gateFile: "./gates/session-state.gate.ts",
      progress: ["DONE"],
    },

    // ============================================================
    // CHECKPOINT 2: Agent Auth 🚧
    // ============================================================
    {
      id: "human-auth",
      title: "Human can sign up/sign in via better-auth",
      gateFile: "./gates/human-auth.gate.ts",
      progress: ["DONE - email/password working"],
    },
    {
      id: "api-key-create",
      title: "Human can create API key for agent via /settings/api-keys",
      gateFile: "./gates/api-key-create.gate.ts",
      dependsOn: ["human-auth"],
      progress: ["UI done, pending DB migration"],
    },
    {
      id: "api-key-auth",
      title: "Agent authenticates with x-api-key header",
      gateFile: "./gates/api-key-auth.gate.ts",
      dependsOn: ["api-key-create"],
      progress: [],
    },
    {
      id: "env-secrets-inject",
      title: "Secrets from API key metadata injected into terminal env",
      gateFile: "./gates/env-secrets-inject.gate.ts",
      dependsOn: ["api-key-auth", "terminal-start"],
      progress: [],
    },

    // ============================================================
    // CHECKPOINT 3: Persistence
    // ============================================================
    {
      id: "session-forever",
      title: "Sessions persist forever until explicitly closed",
      gateFile: "./gates/session-forever.gate.ts",
      dependsOn: ["session-state"],
      progress: [],
    },
    {
      id: "terminal-reconnect",
      title: "Terminal reconnects to existing container on reload",
      gateFile: "./gates/terminal-reconnect.gate.ts",
      dependsOn: ["terminal-websocket", "session-forever"],
      progress: [],
    },

    // ============================================================
    // CHECKPOINT 4: Billing
    // ============================================================
    {
      id: "usage-tracking",
      title: "Track active/idle minutes per API key",
      gateFile: "./gates/usage-tracking.gate.ts",
      dependsOn: ["api-key-auth"],
      progress: [],
    },
    {
      id: "billing-integration",
      title: "Stripe integration for usage billing",
      gateFile: "./gates/billing-integration.gate.ts",
      dependsOn: ["usage-tracking"],
      progress: [],
    },
  ],
});

if (import.meta.main) {
  const result = await runPrd(prd);
  process.exit(result.success ? 0 : 1);
}
