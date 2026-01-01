import type { Agent } from './types';

export function generateDockerfile(agents: Agent[]): string {
  const enabledAgents = agents.filter(a => a.enabled);
  const hasNpmAgents = enabledAgents.some(a => a.id === 'codex' || a.id === 'claude');

  const header = `# Universal AI Agent CLI Base Image
#
# Bundles the major AI coding agents with CLIs into a single reusable container.
# Intended as a base image for orchestration, sandboxing, CI, and serverless containers.
#
# Included agents:`;

  const agentList = enabledAgents
    .map(a => `# - ${a.name}`)
    .join('\n');

  const disclaimer = `#
# This image performs NO authentication at build time.
# All credentials must be provided at runtime.

FROM node:20-bookworm-slim

SHELL ["/bin/bash", "-c"]

# Install base tooling + Bun in single layer (optimized for caching)
RUN apt-get update && apt-get install -y --no-install-recommends \\
  git \\
  ca-certificates \\
  curl \\
  jq \\
  bash \\
  openssh-client \\
  python3 \\
  make \\
  g++ \\
  unzip \\
  && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*

# Install Bun (faster than npm, smaller footprint, better for agents)
RUN curl -fsSL https://bun.sh/install | bash

# Install agentic tools: gh (GitHub CLI) + yq (YAML processor)
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \\
  && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \\
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \\
  && apt-get update && apt-get install -y --no-install-recommends gh \\
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 -o /usr/local/bin/yq \\
  && chmod +x /usr/local/bin/yq

# Common binary install locations used by CLIs
ENV PATH="/root/.bun/bin:/root/.cursor/bin:/root/.local/bin:/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin"`;

  // Build agent installation sections
  const agentSections = enabledAgents
    .map(agent => {
      let section = '';

      switch (agent.id) {
        case 'codex':
          section = `# ------------------------
# OpenAI Codex CLI
# Docs: https://platform.openai.com/docs/guides/codex
# ------------------------
RUN /root/.bun/bin/bun install -g --no-save @openai/codex@latest \\
  && command -v codex \\
  && (codex --version || true)`;
          break;

        case 'cursor-agent':
          section = `# ------------------------
# Cursor CLI / cursor-agent
# Docs: https://cursor.com/docs/cli/overview
# ------------------------
RUN curl -fsS https://cursor.com/install | bash \\
  && command -v cursor-agent \\
  && (cursor-agent --version || true)`;
          break;

        case 'claude':
          section = `# ------------------------
# Claude Code CLI (Anthropic)
# Docs: https://docs.anthropic.com/en/docs/claude-code
# ------------------------
RUN /root/.bun/bin/bun install -g --no-save @anthropic-ai/claude-code@latest \\
  && command -v claude \\
  && (claude --version || true)`;
          break;

        case 'opencode':
          section = `# ------------------------
# OpenCode CLI
# Docs: https://opencode.ai/docs
# ------------------------
RUN curl -fsSL https://opencode.ai/install | bash \\
  && command -v opencode \\
  && (opencode --version || true)`;
          break;

        case 'droid':
          section = `# ------------------------
# Factory "Droid" CLI (Terminal Bench)
# Docs:
# - https://factory.ai/news/terminal-bench
# - https://app.factory.ai
# ------------------------
RUN curl -fsSL https://app.factory.ai/cli | sh \\
  && command -v droid \\
  && (droid --version || true)`;
          break;
      }

      return section;
    })
    .join('\n\n');

  // Build ENV vars only for enabled agents
  const envVars = enabledAgents
    .map(agent => {
      switch (agent.id) {
        case 'codex':
          return 'ENV OPENAI_API_KEY=""';
        case 'cursor-agent':
          return 'ENV CURSOR_API_KEY=""';
        case 'claude':
          return 'ENV ANTHROPIC_API_KEY=""';
        case 'droid':
          return 'ENV FACTORY_API_KEY=""';
        default:
          return null;
      }
    })
    .filter(Boolean)
    .join('\n');

  // Build CMD with only enabled agents
  const whichCommands = enabledAgents
    .map(agent => {
      switch (agent.id) {
        case 'codex':
          return 'which codex';
        case 'cursor-agent':
          return 'which cursor-agent';
        case 'claude':
          return 'which claude';
        case 'opencode':
          return 'which opencode';
        case 'droid':
          return 'which droid';
        default:
          return null;
      }
    })
    .filter(Boolean)
    .join(' && ');

  const envSection = envVars ? `# Runtime auth (set by user)
${envVars}` : '';

  const cmdSection = whichCommands
    ? `CMD ["bash", "-c", "echo Installed CLIs: && ${whichCommands} && echo Ready."]`
    : 'CMD ["bash", "-c", "echo No agents selected."]';

  const footer = `
# Workspace convention
WORKDIR /work

${envSection}

# Smoke output
${cmdSection}`;

  const parts = [header];
  if (agentList) {
    parts.push(agentList);
  }
  parts.push(disclaimer);
  if (agentSections) {
    parts.push(agentSections);
  }
  parts.push(footer);

  return parts.join('\n');
}
