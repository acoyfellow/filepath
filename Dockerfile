FROM docker.io/cloudflare/sandbox:0.7.13

# Install runtime tools for thread sandboxes
RUN apt-get update && \
    apt-get install -y --no-install-recommends git ttyd && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY adapters /opt/filepath/adapters

EXPOSE 7681
