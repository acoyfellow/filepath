FROM docker.io/cloudflare/sandbox:0.7.10

# Install runtime tools for thread sandboxes
RUN apt-get update && \
    apt-get install -y --no-install-recommends git ttyd && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

EXPOSE 7681
