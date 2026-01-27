FROM docker.io/cloudflare/sandbox:0.7.0

# Install tools needed for diagnostics
RUN apt-get update -qq && apt-get install -y --no-install-recommends \
      file binutils gcc libc6-dev xxd \
    && rm -rf /var/lib/apt/lists/*

# --- Test binaries ---

# 1. Shell script (existing hello)
RUN printf '#!/bin/sh\necho hello-from-bin\n' > /usr/local/bin/hello \
  && chmod +x /usr/local/bin/hello

# 2. Shell script variant at hello-script
RUN printf '#!/bin/sh\necho hello-from-script\n' > /usr/local/bin/hello-script \
  && chmod +x /usr/local/bin/hello-script

# 3. Statically linked C binary
RUN printf '#include <stdio.h>\nint main(){puts("hello-from-static");return 0;}\n' > /tmp/hello.c \
  && gcc -static -o /usr/local/bin/hello-static /tmp/hello.c \
  && chmod +x /usr/local/bin/hello-static

# 4. Dynamically linked C binary
RUN gcc -o /usr/local/bin/hello-dynamic /tmp/hello.c \
  && chmod +x /usr/local/bin/hello-dynamic \
  && rm /tmp/hello.c

# Verify all four exist at build time
RUN ls -la /usr/local/bin/hello /usr/local/bin/hello-script \
           /usr/local/bin/hello-static /usr/local/bin/hello-dynamic
