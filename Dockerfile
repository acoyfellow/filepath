FROM --platform=linux/amd64 docker.io/cloudflare/sandbox:0.7.0

# Install ttyd and tmux for shared terminal sessions
# Use minimal install to reduce memory footprint
RUN apt-get update && apt-get install -y --no-install-recommends ttyd tmux curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/* /tmp/* /var/tmp/*

# Pre-install all CLI agents in single layer to reduce image size
RUN bun add -g @anthropic-ai/claude-code @openai/codex && \
    curl -fsS https://cursor.com/install | bash && \
    curl -fsSL https://opencode.ai/install | bash && \
    curl -fsSL https://app.factory.ai/cli | sh && \
    # Clean up bun cache to reduce image size
    rm -rf /root/.bun/install/cache/* && \
    # Clean up any temp files from installs
    rm -rf /tmp/* /var/tmp/*

# Ensure agent CLIs are on PATH
ENV PATH="/root/.opencode/bin:/root/.local/bin:/root/.bun/bin:/usr/local/bin:/usr/bin:/bin"

# Expose ports for ttyd WebSocket and sandbox services
EXPOSE 7681
EXPOSE 3000
EXPOSE 8080
