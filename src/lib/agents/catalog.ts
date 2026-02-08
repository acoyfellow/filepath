import type { AgentCatalogEntry, AgentType } from '$lib/types/session';

export const AGENT_CATALOG: Record<AgentType, AgentCatalogEntry> = {
  shelley: {
    id: 'shelley',
    name: 'Shelley',
    description: 'Experienced software engineer. Builds full-stack apps, manages infrastructure, writes clean code. Best all-rounder.',
    defaultModel: 'claude-sonnet-4',
    icon: '🐚',
  },
  pi: {
    id: 'pi',
    name: 'Pi',
    description: 'Research and analysis specialist. Deep dives into docs, APIs, and codebases. Great for exploration and planning.',
    defaultModel: 'claude-sonnet-4',
    icon: '🥧',
  },
  opencode: {
    id: 'opencode',
    name: 'OpenCode',
    description: 'Open-source coding agent. Lightweight, fast, focused on code generation and refactoring.',
    defaultModel: 'claude-sonnet-4',
    icon: '📖',
  },
  codex: {
    id: 'codex',
    name: 'Codex',
    description: 'OpenAI\'s coding agent. Strong at Python, data science, and scripting tasks.',
    defaultModel: 'o3',
    icon: '📜',
  },
  cursor: {
    id: 'cursor',
    name: 'Cursor',
    description: 'AI-powered code editor agent. Great for interactive editing and code review.',
    defaultModel: 'claude-sonnet-4',
    icon: '🖱️',
  },
  amp: {
    id: 'amp',
    name: 'Amp',
    description: 'Sourcegraph\'s coding agent. Excellent at large codebase navigation and cross-repo changes.',
    defaultModel: 'claude-sonnet-4',
    icon: '⚡',
  },
  'claude-code': {
    id: 'claude-code',
    name: 'Claude Code',
    description: 'Anthropic\'s agentic coding tool. Terminal-native, great at complex multi-file changes.',
    defaultModel: 'claude-sonnet-4',
    icon: '🤖',
  },
  custom: {
    id: 'custom',
    name: 'Custom Agent',
    description: 'Bring your own agent. Configure any Docker image with custom entrypoint and environment.',
    defaultModel: 'claude-sonnet-4',
    icon: '🔧',
  },
};

export const AGENT_LIST = Object.values(AGENT_CATALOG);

export function getAgent(id: AgentType): AgentCatalogEntry {
  return AGENT_CATALOG[id] ?? AGENT_CATALOG.custom;
}

/** @deprecated Roles removed in tree architecture. Returns all agents. */
export function getAgentsByRole(_role: 'orchestrator' | 'worker'): AgentCatalogEntry[] {
  return AGENT_LIST;
}
