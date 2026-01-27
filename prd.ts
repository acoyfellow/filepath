import { definePrd, runPrd } from "gateproof/prd";

/**
 * Product: myFilepath.com (filepath)
 * Concept: 1 Chat Session orchestrates N isolated Terminal Sessions (each with its own agent).
 *
 * Loop discipline (required):
 * - Pick one story -> implement -> verify -> commit -> repeat.
 * - PRD only; one story per iteration; verify before commit.
 * - Memory is files: git commits + prd.ts only.
 * - Progress tracking: each story has a `progress: string[]` in this file.
 * - Agent Loop: after each task, check GH Actions via `gh pr checks <PR_ID> --watch` and only proceed when green.
 *
 * Harness discipline (required):
 * - Dev harness must be green before touching prod.
 * - Prod harness is expected to fail until deployed.
 * - After deploy, re-run prod harness to go green, then move on.
 *
 * Scope target (checkpoint):
 * - No auth (anonymous UX prototype)
 * - Chat Sessions persist (localStorage)
 * - Terminal Sessions are ephemeral (server-side) + isolated (no shared filesystem)
 * - Network ON by default
 *
 * Explicit non-goals (for this handoff):
 * - Customizable / pluggable “different coding agents” system (future)
 * - Shared filesystem across terminals (future; may later be modeled as “folders/workspaces”)
 * - Multi-user collaboration, roles, admin policy, billing enforcement (future)
 *
 * Notes on “agents”:
 * - For this checkpoint, assume a single default coding agent behavior per terminal.
 * - We DO support multiple terminals (parallel agents), but NOT agent customization.
 *
 * Terminal transport (v0):
 * - Real terminal via ttyd over WebSocket (PTY semantics).
 * - UI uses iframe-per-tab to isolate terminal runtime and avoid cross-terminal state bleed.
 */

export const prd = definePrd({
  progressLog: [
    "Implemented chat -> terminal task assignment with status and outputs.",
    "Added command audit log with actor attribution.",
    "Marked terminals expired on reload until iframe connects.",
    "Default terminal now launches opencode in ttyd.",
    "Prod WS fixed: header pass-through for ttyd wsConnect + browser WS no subprotocol; /terminal/.../ws now connects.",
    "Prod harness: prod-terminal-ws check passes; harness-prod-smoke green against api.myfilepath.com.",
    "Added minimal repro folders for sandbox issues (#309) and observed platform instability in repro runs."
  ],
  stories: [
    // EPIC: Harnesses (dev must be green; prod fails until deploy)
    {
      id: "harness-dev-local",
      title:
        "Dev harness: local web + worker stack starts, UI responds at http://localhost:5173, and API works at http://localhost:1337",
      gateFile: "./gates/harness-dev-local.gate.ts",
      progress: [
        "Started alchemy dev stack; harness-dev-local passes (localhost:5173 + localhost:1337)."
      ],
    },
    {
      id: "harness-prod-smoke",
      title:
        "Prod harness: PROD_URL responds with 200 and Cloudflare logs show no errors (expected to fail until deployed)",
      gateFile: "./gates/harness-prod-smoke.gate.ts",
      dependsOn: ["harness-dev-local"],
      progress: [
        "Added WS debug check to prod harness; prod-terminal-ws now passes.",
        "Harness-prod-smoke green (using api.myfilepath.com origin)."
      ],
    },

    // EPIC: Session (Chat) persistence with zero auth
    {
      id: "session-create-and-list",
      title:
        "User can create a Chat Session and see it in a Sessions list (anonymous, no auth)",
      gateFile: "./gates/session-create-and-list.gate.ts",
      progress: [
        "Added Sessions panel with create + switch; session list stored locally and active session syncs to API."
      ],
    },
    {
      id: "session-persists-localstorage",
      title:
        "Chat Session state persists to localStorage and restores on reload (no auth)",
      gateFile: "./gates/session-persists-localstorage.gate.ts",
      dependsOn: ["session-create-and-list"],
      progress: [
        "Per-session history stored under unique keys; session list + active session saved and rehydrated from localStorage."
      ],
    },

    // EPIC: Terminal Sessions (ephemeral, isolated, network on)
    {
      id: "terminal-create-ephemeral",
      title:
        "User can create an ephemeral Terminal Session tab inside a Chat Session",
      gateFile: "./gates/terminal-create-ephemeral.gate.ts",
      dependsOn: ["session-create-and-list"],
      progress: [
        "Terminal panel renders iframe per tab and create button wired to backend tab start."
      ],
    },
    {
      id: "terminal-backend-pty-ws",
      title:
        "Terminal backend provisions a PTY and streams I/O over WebSocket per terminal",
      gateFile: "./gates/terminal-backend-pty-ws.gate.ts",
      dependsOn: ["terminal-create-ephemeral"],
      progress: [
        "Default terminal command launches opencode (fallback to bash) with ttyd.",
        "WebSocketPair handler and /terminal/:session/:tab/(start|ws) logic present.",
        "Sandbox processes now export `OPENCODE_ZEN_API_KEY` so opencode sees upstream credentials."
      ],
    },
    {
      id: "terminal-viewer-ui",
      title:
        "UI renders a real terminal viewport with interactive input (ANSI + PTY semantics)",
      gateFile: "./gates/terminal-viewer-ui.gate.ts",
      dependsOn: ["terminal-create-ephemeral"],
      progress: [
        "Terminal iframe loads `xterm` + /terminal/:session/tab page with ANSI UI wired."
      ],
    },
    {
      id: "terminal-io-streaming",
      title:
        "Terminal streams stdout/stderr in real time and accepts interactive input",
      gateFile: "./gates/terminal-io-streaming.gate.ts",
      dependsOn: ["terminal-backend-pty-ws", "terminal-viewer-ui"],
      progress: [
        "Terminal WebSocket bridges onData/onMessage with xterm and binary chunks (`CMD_OUTPUT`)."
      ],
    },
    {
      id: "terminal-multiple-tabs",
      title:
        "User can create N terminal tabs and switch between them without losing scrollback",
      gateFile: "./gates/terminal-multiple-tabs.gate.ts",
      dependsOn: ["terminal-io-streaming"],
      progress: [
        "Tabs arrays + statuses already exist; UI renders multiple iframe tabs with active/closed states."
      ],
    },
    {
      id: "terminal-isolation-no-shared-filesystem",
      title:
        "Each terminal is isolated: filesystem writes in Terminal A are not visible in Terminal B",
      gateFile: "./gates/terminal-isolation-no-shared-filesystem.gate.ts",
      dependsOn: ["terminal-multiple-tabs"],
      progress: [],
    },
    {
      id: "terminal-network-on-by-default",
      title:
        "Network is on by default inside terminals (basic outbound request succeeds)",
      gateFile: "./gates/terminal-network-on-by-default.gate.ts",
      dependsOn: ["terminal-create-ephemeral"],
      progress: [],
    },

    // EPIC: Chat as orchestrator (task routing + lifecycle)
    {
      id: "chat-orchestrates-terminal-task",
      title:
        "From chat, user can assign a task to a specific terminal and see status updates (queued → running → done/failed)",
      gateFile: "./gates/chat-orchestrates-terminal-task.gate.ts",
      dependsOn: ["terminal-io-streaming"],
      progress: [
        "Added /terminal/:sessionId/:tabId/task endpoint with exec + status updates.",
        "UI now assigns chat input to a terminal with status chips and task output."
      ],
    },
    {
      id: "chat-fanout-multiple-terminals",
      title:
        "One chat message can fan out tasks to multiple terminals and report results back per terminal",
      gateFile: "./gates/chat-fanout-multiple-terminals.gate.ts",
      dependsOn: ["chat-orchestrates-terminal-task", "terminal-multiple-tabs"],
      progress: [],
    },

    // EPIC: Human override / jump-in behavior (no fighting)
    {
      id: "jump-in-pauses-agent",
      title:
        "When user focuses a terminal and types, the agent yields control (no interleaved keystrokes) and can be resumed",
      gateFile: "./gates/jump-in-pauses-agent.gate.ts",
      dependsOn: ["chat-orchestrates-terminal-task", "terminal-io-streaming"],
      progress: [],
    },

    // EPIC: Allow changes
    {
      id: "allow-changes-toggle",
      title:
        "Each terminal has an 'Allow changes' control: when ON, agent may write files; when OFF, write attempts are blocked and explained",
      gateFile: "./gates/allow-changes-toggle.gate.ts",
      dependsOn: [
        "chat-orchestrates-terminal-task",
        "terminal-io-streaming",
        "terminal-isolation-no-shared-filesystem",
      ],
      progress: [],
    },

    // EPIC: Auditability
    {
      id: "command-audit-log",
      title:
        "Every executed command is logged with actor attribution (user vs agent) and timestamps",
      gateFile: "./gates/command-audit-log.gate.ts",
      dependsOn: ["terminal-io-streaming", "chat-orchestrates-terminal-task"],
      progress: [
        "Added audit tracking in worker and UI list with actor + status."
      ],
    },

    // EPIC: Terminal ephemeral reality vs persisted session UI
    {
      id: "reload-restores-chat-terminals-mark-expired",
      title:
        "On reload: chat history restores from localStorage; any prior terminals are shown as expired/disconnected and can be recreated",
      gateFile:
        "./gates/reload-restores-chat-terminals-mark-expired.gate.ts",
      dependsOn: [
        "session-persists-localstorage",
        "terminal-create-ephemeral",
        "terminal-multiple-tabs",
      ],
      progress: [
        "Iframe posts terminal status to parent; tabs marked expired on reload until connected."
      ],
    },

    // FUTURE: Agent CLI swap (commented to prevent scope creep)
    // {
    //   id: "terminal-agent-cli-swap",
    //   title:
    //     "User can swap the terminal's active coding agent CLI without changing the terminal",
    //   gateFile: "./gates/terminal-agent-cli-swap.gate.ts",
    //   dependsOn: ["terminal-io-streaming", "terminal-multiple-tabs"],
    // },
    // FUTURE: User auth, billing, limits (commented to prevent scope creep)
    // {
    //   id: "user-authentication",
    //   title: "User accounts, session ownership, and workspace membership",
    //   gateFile: "./gates/user-authentication.gate.ts",
    // },
    // {
    //   id: "billing-and-usage-limits",
    //   title: "Billing, quotas, and usage limits for terminals and sessions",
    //   gateFile: "./gates/billing-and-usage-limits.gate.ts",
    //   dependsOn: ["user-authentication"],
    // },
  ],
});

if (import.meta.main) {
  const result = await runPrd(prd);
  process.exit(result.success ? 0 : 1);
}
