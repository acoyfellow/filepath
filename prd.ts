import { definePrd, runPrd } from "gateproof/prd";

/**
 * Product: myFilepath.com (filepath)
 * Concept: 1 Chat Session orchestrates N isolated Terminal Sessions (each with its own agent).
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
  stories: [
    // EPIC: Session (Chat) persistence with zero auth
    {
      id: "session-create-and-list",
      title:
        "User can create a Chat Session and see it in a Sessions list (anonymous, no auth)",
      gateFile: "./gates/session-create-and-list.gate.ts",
    },
    {
      id: "session-persists-localstorage",
      title:
        "Chat Session state persists to localStorage and restores on reload (no auth)",
      gateFile: "./gates/session-persists-localstorage.gate.ts",
      dependsOn: ["session-create-and-list"],
    },

    // EPIC: Terminal Sessions (ephemeral, isolated, network on)
    {
      id: "terminal-create-ephemeral",
      title:
        "User can create an ephemeral Terminal Session tab inside a Chat Session",
      gateFile: "./gates/terminal-create-ephemeral.gate.ts",
      dependsOn: ["session-create-and-list"],
    },
    {
      id: "terminal-backend-pty-ws",
      title:
        "Terminal backend provisions a PTY and streams I/O over WebSocket per terminal",
      gateFile: "./gates/terminal-backend-pty-ws.gate.ts",
      dependsOn: ["terminal-create-ephemeral"],
    },
    {
      id: "terminal-viewer-ui",
      title:
        "UI renders a real terminal viewport with interactive input (ANSI + PTY semantics)",
      gateFile: "./gates/terminal-viewer-ui.gate.ts",
      dependsOn: ["terminal-create-ephemeral"],
    },
    {
      id: "terminal-io-streaming",
      title:
        "Terminal streams stdout/stderr in real time and accepts interactive input",
      gateFile: "./gates/terminal-io-streaming.gate.ts",
      dependsOn: ["terminal-backend-pty-ws", "terminal-viewer-ui"],
    },
    {
      id: "terminal-multiple-tabs",
      title:
        "User can create N terminal tabs and switch between them without losing scrollback",
      gateFile: "./gates/terminal-multiple-tabs.gate.ts",
      dependsOn: ["terminal-io-streaming"],
    },
    {
      id: "terminal-isolation-no-shared-filesystem",
      title:
        "Each terminal is isolated: filesystem writes in Terminal A are not visible in Terminal B",
      gateFile: "./gates/terminal-isolation-no-shared-filesystem.gate.ts",
      dependsOn: ["terminal-multiple-tabs"],
    },
    {
      id: "terminal-network-on-by-default",
      title:
        "Network is on by default inside terminals (basic outbound request succeeds)",
      gateFile: "./gates/terminal-network-on-by-default.gate.ts",
      dependsOn: ["terminal-create-ephemeral"],
    },

    // EPIC: Chat as orchestrator (task routing + lifecycle)
    {
      id: "chat-orchestrates-terminal-task",
      title:
        "From chat, user can assign a task to a specific terminal and see status updates (queued → running → done/failed)",
      gateFile: "./gates/chat-orchestrates-terminal-task.gate.ts",
      dependsOn: ["terminal-io-streaming"],
    },
    {
      id: "chat-fanout-multiple-terminals",
      title:
        "One chat message can fan out tasks to multiple terminals and report results back per terminal",
      gateFile: "./gates/chat-fanout-multiple-terminals.gate.ts",
      dependsOn: ["chat-orchestrates-terminal-task", "terminal-multiple-tabs"],
    },

    // EPIC: Human override / jump-in behavior (no fighting)
    {
      id: "jump-in-pauses-agent",
      title:
        "When user focuses a terminal and types, the agent yields control (no interleaved keystrokes) and can be resumed",
      gateFile: "./gates/jump-in-pauses-agent.gate.ts",
      dependsOn: ["chat-orchestrates-terminal-task", "terminal-io-streaming"],
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
    },

    // EPIC: Auditability
    {
      id: "command-audit-log",
      title:
        "Every executed command is logged with actor attribution (user vs agent) and timestamps",
      gateFile: "./gates/command-audit-log.gate.ts",
      dependsOn: ["terminal-io-streaming", "chat-orchestrates-terminal-task"],
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
