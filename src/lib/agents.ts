export type AgentId = 'claude' | 'codex' | 'cursor' | 'opencode' | 'droid';

export interface Agent {
  id: AgentId;
  name: string;
  description: string;
  install: string;
  envKey: string | null;
  command: string;
  docsUrl: string;
  logoUrl: string;
}

export const AGENTS: Record<AgentId, Agent> = {
  claude: {
    id: 'claude',
    name: 'Claude Code',
    description: 'Anthropic\'s Claude for code assistance',
    install: 'bun install -g @anthropic-ai/claude-code',
    envKey: 'ANTHROPIC_API_KEY',
    command: 'claude',
    docsUrl: 'https://docs.anthropic.com/en/docs/claude-code',
    logoUrl: '/claude.webp',
  },
  codex: {
    id: 'codex',
    name: 'OpenAI Codex',
    description: 'OpenAI\'s code generation CLI',
    install: 'bun install -g @openai/codex',
    envKey: 'OPENAI_API_KEY',
    command: 'codex',
    docsUrl: 'https://developers.openai.com/codex',
    logoUrl: '/codex.webp',
  },
  cursor: {
    id: 'cursor',
    name: 'Cursor CLI',
    description: 'Cursor\'s AI pair programming agent',
    install: 'curl -fsS https://cursor.com/install | bash',
    envKey: 'CURSOR_API_KEY',
    command: 'cursor-agent',
    docsUrl: 'https://cursor.com/docs/cli/overview',
    logoUrl: '/cursor.svg',
  },
  opencode: {
    id: 'opencode',
    name: 'OpenCode CLI',
    description: 'Open-source code intelligence agent',
    install: 'curl -fsSL https://opencode.ai/install | bash',
    envKey: null,
    command: 'opencode',
    docsUrl: 'https://opencode.ai/docs',
    logoUrl: '/opencode.svg',
  },
  droid: {
    id: 'droid',
    name: 'Factory Droid',
    description: 'Autonomous code generation droid',
    install: 'curl -fsSL https://app.factory.ai/cli | sh',
    envKey: 'FACTORY_API_KEY',
    command: 'droid',
    docsUrl: 'https://docs.factory.ai/cli/getting-started/quickstart',
    logoUrl: '/factory.svg',
  },
} as const;

export const AGENT_LIST = Object.values(AGENTS);

