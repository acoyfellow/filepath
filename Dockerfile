FROM docker.io/cloudflare/sandbox:0.7.0

# Install ttyd for terminal
RUN apt-get update && apt-get install -y --no-install-recommends ttyd && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Expose port for ttyd
EXPOSE 7681
