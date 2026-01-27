FROM docker.io/cloudflare/sandbox:0.7.0

# Create a tiny executable in a well-known path
RUN printf '#!/bin/sh\necho hello-from-bin\n' > /usr/local/bin/hello \
  && chmod +x /usr/local/bin/hello \
  && ls -l /usr/local/bin/hello
