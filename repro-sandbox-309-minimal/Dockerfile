FROM docker.io/cloudflare/sandbox:0.7.0

# Install claude-code globally, as in the upstream repro comment.
RUN npm install -g @anthropic-ai/claude-code \
  && which claude \
  && ls -la /usr/local/bin/claude \
  && file /usr/local/bin/claude
