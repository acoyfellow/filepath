FROM cloudflare/sandbox:0.6.7

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 && \
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

EXPOSE 8080

# Simple hello world server using Python
CMD ["python3", "-m", "http.server", "8080"]

