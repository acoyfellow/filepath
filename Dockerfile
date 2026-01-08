FROM ubuntu:22.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    ttyd bash curl ca-certificates && \
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

EXPOSE 7681

CMD ["ttyd", "-W", "-p", "7681", "bash"]

