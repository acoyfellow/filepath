import type { AgentCatalogEntry, AgentType } from "$lib/types/session";

export const AGENT_CATALOG: Record<AgentType, AgentCatalogEntry> = {
  shelley: {
    id: "shelley",
    name: "Shelley",
    description: "Full-stack engineering agent. filepath-native reference implementation.",
    defaultModel: "anthropic/claude-sonnet-4",
    icon: "shell",
  },
  pi: {
    id: "pi",
    name: "Pi",
    description: "Research and analysis. Deep dives into docs, APIs, codebases.",
    defaultModel: "anthropic/claude-sonnet-4",
    icon: "search",
  },
  "claude-code": {
    id: "claude-code",
    name: "Claude Code",
    description: "Anthropic's agentic coding tool. Complex multi-file changes.",
    defaultModel: "anthropic/claude-sonnet-4",
    icon: "bot",
  },
  codex: {
    id: "codex",
    name: "Codex",
    description: "OpenAI's coding agent. Strong at Python, scripting, data.",
    defaultModel: "openai/o3",
    icon: "scroll",
  },
  cursor: {
    id: "cursor",
    name: "Cursor",
    description: "Cursor's agent mode via CLI. IDE-grade code intelligence.",
    defaultModel: "anthropic/claude-sonnet-4",
    icon: "mouse-pointer",
  },
  amp: {
    id: "amp",
    name: "Amp",
    description: "Sourcegraph's agent. Large codebase navigation, cross-repo changes.",
    defaultModel: "anthropic/claude-sonnet-4",
    icon: "zap",
  },
  opencode: {
    id: "opencode",
    name: "OpenCode",
    description: "Open-source coding agent. Terminal-based development.",
    defaultModel: "anthropic/claude-sonnet-4",
    icon: "terminal",
  },
  custom: {
    id: "custom",
    name: "Custom",
    description: "Bring your own agent. Dockerfile that speaks the filepath protocol.",
    defaultModel: "anthropic/claude-sonnet-4",
    icon: "box",
  },
};

export const AGENT_LIST = Object.values(AGENT_CATALOG);

export function getAgent(id: AgentType): AgentCatalogEntry {
  return AGENT_CATALOG[id] ?? AGENT_CATALOG.custom;
}
