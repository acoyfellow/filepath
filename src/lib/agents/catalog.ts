import type { AgentCatalogEntry, AgentType } from '$lib/types/session';

export const AGENT_CATALOG: Record<AgentType, AgentCatalogEntry> = {
  shelley: {
    id: 'shelley',
    name: 'Shelley',
    description: 'Experienced software engineer. Builds full-stack apps, manages infrastructure, writes clean code. Best all-rounder.',
    roles: ['orchestrator', 'worker'],
    defaultModel: 'claude-sonnet-4',
    defaultRouter: 'direct',
    imageName: 'shelley-agent',
    icon: '🐚',
  },
  pi: {
    id: 'pi',
    name: 'Pi',
    description: 'Research and analysis specialist. Deep dives into docs, APIs, and codebases. Great for exploration and planning.',
    roles: ['orchestrator', 'worker'],
    defaultModel: 'claude-sonnet-4',
    defaultRouter: 'direct',
    imageName: 'pi-agent',
    icon: '🥧',
  },
  opencode: {
    id: 'opencode',
    name: 'OpenCode',
    description: 'Open-source coding agent. Lightweight, fast, focused on code generation and refactoring.',
    roles: ['worker'],
    defaultModel: 'claude-sonnet-4',
    defaultRouter: 'direct',
    imageName: 'opencode-agent',
    icon: '📖',
  },
  codex: {
    id: 'codex',
    name: 'Codex',
    description: 'OpenAI\'s coding agent. Strong at Python, data science, and scripting tasks.',
    roles: ['worker'],
    defaultModel: 'o3',
    defaultRouter: 'direct',
    imageName: 'codex-agent',
    icon: '📜',
  },
  amp: {
    id: 'amp',
    name: 'Amp',
    description: 'Sourcegraph\'s coding agent. Excellent at large codebase navigation and cross-repo changes.',
    roles: ['worker'],
    defaultModel: 'claude-sonnet-4',
    defaultRouter: 'direct',
    imageName: 'amp-agent',
    icon: '⚡',
  },
  'claude-code': {
    id: 'claude-code',
    name: 'Claude Code',
    description: 'Anthropic\'s agentic coding tool. Terminal-native, great at complex multi-file changes.',
    roles: ['orchestrator', 'worker'],
    defaultModel: 'claude-sonnet-4',
    defaultRouter: 'direct',
    imageName: 'claude-code-agent',
    icon: '🤖',
  },
  custom: {
    id: 'custom',
    name: 'Custom Agent',
    description: 'Bring your own agent. Configure any Docker image with custom entrypoint and environment.',
    roles: ['orchestrator', 'worker'],
    defaultModel: 'claude-sonnet-4',
    defaultRouter: 'direct',
    imageName: 'custom-agent',
    icon: '🔧',
  },
};

export const AGENT_LIST = Object.values(AGENT_CATALOG);

export function getAgent(id: AgentType): AgentCatalogEntry {
  return AGENT_CATALOG[id] ?? AGENT_CATALOG.custom;
}

export function getAgentsByRole(role: 'orchestrator' | 'worker'): AgentCatalogEntry[] {
  return AGENT_LIST.filter(a => a.roles.includes(role));
}
