FROM docker.io/cloudflare/sandbox:0.6.7

# Install ttyd and tmux for shared terminal sessions
RUN apt-get update && apt-get install -y ttyd tmux && rm -rf /var/lib/apt/lists/*

# Expose port for ttyd terminal server
EXPOSE 7681

