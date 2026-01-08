FROM cloudflare/sandbox:0.6.7

RUN apt-get update && apt-get install -y --no-install-recommends ttyd curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
