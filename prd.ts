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
    "Added minimal repro folders for sandbox issues (#309) and observed platform instability in repro runs.",
    "Documented `repro-sandbox-309-minimal` steps and ran `/spawn-test` + `/agent-sdk-test` locally via `wrangler dev` to surface spawn behavior.",
    "Prod repro attempt: /run commands (ls/bun/node) on myfilepath.com exit 1 with empty output; /terminal task on api.myfilepath.com returns SandboxError 500.",
    "Tailed worker logs and saw `SandboxError: Maximum number of running container instances exceeded` during `/terminal/.../start`; next step was to raise sandbox capacity.",
    "Increased sandbox maxInstances to 2, redeployed with `NODE_ENV=production`, and confirmed myfilepath.com/api.myfilepath.com stayed bound while `/run` and `/terminal/.../start` succeeded (via `curl --resolve`).",
    "Deployed the minimal repro worker as sandbox-sdk-309-minimal.coy.workers.dev and confirmed /spawn-test executes the claude spawn check there.",
    "Implemented session-close: DELETE /session/:id backend endpoint + closeSession() frontend handler + close button UI. Deployed to filepath-app.coy.workers.dev.",
    "Extended repro-sandbox-spawn-enoent with deep diagnostics: /diagnostics (file/ldd/readelf/xxd/linker), /spawn-test (static vs dynamic vs script), /workerd-compat (child_process compat matrix), /delay-test (startup-window hypothesis). Deployed to sandbox-spawn-enoent-repro.coy.workers.dev."
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
      id: "session-close",
      title:
        "User can close a Chat Session, which recursively tears down all its terminal tabs (sandbox containers released)",
      gateFile: "./gates/session-close.gate.ts",
      dependsOn: ["session-create-and-list", "terminal-create-ephemeral"],
      progress: [
        "Added DELETE /session/:id backend endpoint that iterates session.tabs calling closeTerminal(), closes session WebSocket clients, and deletes from sessions/sessionClients/tasksBySession/auditBySession maps. Idempotent (returns success even if session not found). CORS updated to allow DELETE.",
        "Added closeSession() frontend handler: confirms via window.confirm, calls DELETE /session/:id, closes tabs WebSocket if active session, removes from state + localStorage, removes chat history key, switches to next session or creates fresh default.",
        "Added close button (x) next to each session in the session panel with red hover state. Refactored session-item from single button to flex container with session-item-button + session-close.",
        "Deployed to https://filepath-app.coy.workers.dev."
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
        "Terminal WebSocket bridges onData/onMessage with xterm and binary chunks (`CMD_OUTPUT`).",
        "Prod sandbox still aborts while ttyd spins up; logs report `Network connection lost` and DO resets once ttyd hits port 7681.",
        "Prod sandbox occasionally resets while ttyd is warming up; logs show `Network connection lost` and DO restarts after port check. Next agent should monitor container health/timeouts so the DO can stay alive through ttyd boot.",
        "BLOCKER (Jan 27 2026): Cloudflare incident https://www.cloudflarestatus.com/incidents/54h1hbfvchlf — elevated errors and query timeouts for D1 and SQLite-backed Durable Objects (started Jan 25, fix rolling out Jan 27). DO resets during ttyd boot may be platform-side, not ours. Re-test prod after Cloudflare confirms resolution before debugging further."
      ]
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
      progress: [
        "Each tab uses sandbox sessions keyed by `${sessionId}:${tabId}`; terminalId/shard mapping keeps filesystem per tab."
      ],
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

    // EPIC: Platform reproducibility
    {
      id: "sandbox-issue-309-repro",
      title:
        "Document minimal reproduction for sandbox-sdk issue #309 (child_process.spawn ENOENT) and capture local behavior",
      gateFile: "./gates/sandbox-issue-309-repro.gate.ts",
      progress: [
        "Copied the reproduction from the issue comment into `repro-sandbox-309-minimal`, ran the examples with `wrangler dev`, and confirmed both `/spawn-test` and `/agent-sdk-test` return exit code 0; platform still needs remote confirmation.",
        "Deployed `sandbox-sdk-309-minimal` (https://sandbox-sdk-309-minimal.coy.workers.dev) and verified `/spawn-test` hits the repro worker with working `accessSync` + `spawnSync` data.",
        "Re-ran `gates/sandbox-issue-309-repro.gate.ts` (passes).",
        "Prod data: `POST https://myfilepath.com/run` (X-Session-Id set) running `ls -la /`, `bun -v`, and `node -e ...spawnSync...` returns exitCode=1 with empty stdout/stderr.",
        "Prod data: `POST https://api.myfilepath.com/terminal/<session>/<tab>/task` with `ls -la /` returns `SandboxError: HTTP error! status: 500`.",
        "Tailed the prod worker logs and saw `/terminal/.../start` hit `SandboxError: Maximum number of running container instances exceeded` before a spawn could run.",
        "Local container shows the claude CLI executing successfully, so the ENOENT must still be a remote/production anomaly; capture Cloudflare logs or additional sandbox incidence as the next proof.",
        "Prod repro is currently failing earlier than ENOENT: /run shell results are empty with exit code 1, and /terminal task exec returns 500."
      ],
    },
    {
      id: "prod-shell-recovery",
      title:
        "Root cause the `/run` and `/terminal/:session/:tab/task` failures on myfilepath.com and restore basic command execution",
      gateFile: "./gates/prod-shell-recovery.gate.ts",
      dependsOn: ["sandbox-issue-309-repro"],
      progress: [
        "Confirmed that every `POST https://myfilepath.com/run` command exits 1 with empty stdout/stderr and terminal tasks report `SandboxError: HTTP error! status: 500` before spawning any processes.",
        "Plan: gather Cloudflare worker + sandbox logs for the failing requests, reproduce the condition with a simple command, and identify the sandbox or binding issue blocking `/run` and `/terminal`.",
        "Worker logs now show the sandbox hitting the `max_instances` cap during `/terminal/.../start`; we need to bump that limit (or ensure containers are released) so these endpoints can succeed.",
        "Raised the sandbox `maxInstances`, redeployed with `NODE_ENV=production`, and verified `/run` + `/terminal/:session/:tab/start` succeed via `curl --resolve` and tail logs (only the expected DO reset remains).",
        "Rechecked a terminal start just now and the log shows `[terminal] ready` with no further sandbox errors, so the UI should stop showing `[expired]`.",
        "Until `/run` and terminal tasks accept commands, none of the sandbox repros can run in production; this story is about clearing that first layer of failure before revalidating ENOENT.",
        "Next step: monitor that `/run` and `/terminal` stay healthy as DNS propagates without needing the `--resolve` shortcut."
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
