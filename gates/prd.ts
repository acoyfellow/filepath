import { definePrd, runPrd } from "gateproof/prd";

/**
 * myfilepath.com — Agent Orchestration Platform
 *
 * TRUE NORTH STAR:
 *   Login → Create session → Spawn agent → Type message → Get LLM response
 *   Screenshot proof of each step or it didn't happen.
 *
 * Checkpoints:
 * 1. Auth & Navigation — Login, sign out, settings pages load
 * 2. Session & Agent — Create session, spawn agent, see tree + chat
 * 3. Chat E2E — Send message, get LLM response displayed in chat
 * 4. Polish — No 404s, no console errors, agent count correct
 */

export const prd = definePrd({
  progressLog: [
    "2026-02-24: Phase 1 — Build passes (0 errors), deploy works",
    "2026-02-24: Phase 2 — Nav fixed: sign out on dashboard+session, /settings redirect",
    "2026-02-24: Phase 3 — Session creation, agent spawn, tree+chat view working",
    "2026-02-24: Phase 4 — ChatAgent calls LLM directly via OpenAI (OpenRouter expired)",
    "2026-02-24: Phase 4 — ChatAgent calls LLM directly via OpenAI (OpenRouter expired)",
  stories: [
    // ============================================================
    // CHECKPOINT 1: Auth & Navigation
    // ============================================================
    {
      id: "login-flow",
      title: "Login with email/password → lands on /dashboard",
      gateFile: "./gates/production/auth-flow.gate.sh",
      progress: ["DONE"],
    },
    {
      id: "sign-out",
      title: "Sign out button visible on dashboard + session, returns to landing",
      gateFile: "./gates/production/auth-flow.gate.sh",
      dependsOn: ["login-flow"],
      progress: ["DONE"],
    },
    {
      id: "settings-pages",
      title: "/settings/account, /settings/api-keys all load (no 404)",

    // ============================================================
    // CHECKPOINT 2: Session & Agent
    // ============================================================
    {
      id: "create-session",
      title: "Create session from dashboard → navigates to session view",
      gateFile: "./gates/production/agent-chat.gate.sh",
      dependsOn: ["login-flow"],
      progress: ["DONE"],
    },
    {
      id: "spawn-agent",
      title: "Spawn agent → appears in tree sidebar + panel shows type/model",
      gateFile: "./gates/production/agent-chat.gate.sh",
      dependsOn: ["create-session"],
      progress: ["DONE"],
    },
    {
      id: "dashboard-lists",
      title: "Dashboard lists sessions with correct agent count + working links",
      gateFile: "./gates/production/agent-chat.gate.sh",
      dependsOn: ["spawn-agent"],
      progress: ["BUG: agent count always shows 0"],
    },

    // ============================================================
    // CHECKPOINT 3: Chat E2E ← THE NORTH STAR
    // ============================================================
    {
      id: "agent-chat-e2e",
      title: "Send message to agent → LLM responds → response displayed in chat",
      gateFile: "./gates/production/agent-chat.gate.sh",
      dependsOn: ["spawn-agent"],
      progress: ["DONE — OpenAI fallback when OpenRouter key expired"],
    },
    {
      id: "agent-chat-multi",
      title: "Multi-turn conversation works (agent remembers context)",
      gateFile: "./gates/production/agent-chat.gate.sh",
      dependsOn: ["agent-chat-e2e"],
      progress: ["BUG: chat history lost between messages (in-memory only)"],
    },

    // ============================================================
    // CHECKPOINT 4: Polish
    // ============================================================

    // ============================================================
    // CHECKPOINT 5: Polish
    // ============================================================
    {
      id: "no-404s",
      title: "No 404s on critical paths (landing, login, dashboard, session, settings)",
      gateFile: "./gates/production/visual-regression.gate.sh",
      progress: ["DONE"],
    },
  ],
});

if (import.meta.main) {
  const result = await runPrd(prd);
  process.exit(result.success ? 0 : 1);
}
