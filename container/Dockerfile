# filepath agent container
# bun + chromium + playwright + claude

FROM oven/bun:1 AS base

# Install chromium and dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Claude CLI
RUN curl -fsSL https://claude.ai/install.sh | sh || echo "Claude CLI install skipped"

# Set up app directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies including playwright
RUN bun install
RUN bunx playwright install chromium

# Copy agent code
COPY agent/ ./agent/

# Set environment
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

# Default command: run agent
CMD ["bun", "run", "/app/agent/index.ts"]
