FROM docker.io/cloudflare/sandbox:0.6.7

# Install ttyd and tmux for shared terminal sessions
RUN apt-get update && apt-get install -y ttyd tmux && rm -rf /var/lib/apt/lists/*

# Pre-install CLI agents for faster session startup
RUN bun add -g @anthropic-ai/claude-code @openai/codex

# Expose port for ttyd terminal server
EXPOSE 7681

