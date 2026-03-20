FROM docker.io/cloudflare/sandbox:0.7.13

# Install runtime tools for thread sandboxes
RUN apt-get update && \
    # NOTE: python3.11-pip is not available in this base image's apt repos.
    # We rely on `python3.11-venv` so `python -m venv` produces a venv with `bin/pip`.
    apt-get install -y --no-install-recommends git ttyd python3 python3-venv python3-pip python3.11 python3.11-venv && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

ENV FILEPATH_PYTHON=/usr/bin/python3.11

COPY adapters /opt/filepath/adapters

EXPOSE 7681
