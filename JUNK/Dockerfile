FROM docker.io/cloudflare/sandbox:0.6.7

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

# PATH will be set at runtime to avoid loading all binaries into memory at startup
# Base PATH only - agents added dynamically
ENV PATH="/usr/local/bin:/usr/bin:/bin"

# Expose port for ttyd WebSocket
EXPOSE 7681

