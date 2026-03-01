import type { AgentCatalogEntry, AgentType } from "$lib/types/session";
import { DEFAULT_MODEL_FULL } from "$lib/config";

export const AGENT_CATALOG: Record<AgentType, AgentCatalogEntry> = {
  shelley: {
    id: "shelley",
    name: "Shelley",
    description: "Full-stack engineering agent. filepath-native reference implementation.",
    defaultModel: DEFAULT_MODEL_FULL,
    icon: "shell",
  },
  pi: {
    id: "pi",
    name: "Pi",
    description: "Research and analysis. Deep dives into docs, APIs, codebases.",
    defaultModel: DEFAULT_MODEL_FULL,
    icon: "search",
  },
  "claude-code": {
    id: "claude-code",
    name: "Claude Code",
    description: "Anthropic's agentic coding tool. Complex multi-file changes.",
    defaultModel: DEFAULT_MODEL_FULL,
    icon: "bot",
  },
  codex: {
    id: "codex",
    name: "Codex",
    description: "OpenAI's coding agent. Strong at Python, scripting, data.",
    defaultModel: "openai/gpt-5",
    icon: "scroll",
  },
  cursor: {
    id: "cursor",
    name: "Cursor",
    description: "Cursor's agent mode via CLI. IDE-grade code intelligence.",
    defaultModel: DEFAULT_MODEL_FULL,
    icon: "mouse-pointer",
  },
  amp: {
    id: "amp",
    name: "Amp",
    description: "Sourcegraph's agent. Large codebase navigation, cross-repo changes.",
    defaultModel: DEFAULT_MODEL_FULL,
    icon: "zap",
  },
  opencode: {
    id: "opencode",
    name: "OpenCode",
    description: "Open-source coding agent. Terminal-based development.",
    defaultModel: DEFAULT_MODEL_FULL,
    icon: "terminal",
  },
  custom: {
    id: "custom",
    name: "Custom",
    description: "Bring your own agent. Dockerfile that speaks the filepath protocol.",
    defaultModel: DEFAULT_MODEL_FULL,
    icon: "box",
  },
};

export const AGENT_LIST = Object.values(AGENT_CATALOG);

export function getAgent(id: AgentType): AgentCatalogEntry {
  return AGENT_CATALOG[id] ?? AGENT_CATALOG.custom;
}
