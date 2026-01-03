# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Terminal session sharing platform for AI coding agents (Claude, Codex, Cursor, OpenCode, Droid). Users select agents, launch isolated terminal sessions, and share them via URL for real-time collaboration.

## Commands

```bash
# Development (cleans docker containers, runs alchemy dev)
bun run dev

# Type checking
bun run check

# Deploy to production (myfilepath.com)
bun run deploy

# Build frontend only
bun run build

# Clean up docker containers
bun run clean

# Full cleanup (docker + volumes + .alchemy)
bun run clean:all
```

## Architecture

### Stack
- **Frontend**: SvelteKit (Svelte 5 with runes) + Tailwind CSS v4
- **Backend**: Cloudflare Workers with Hono
- **Terminal**: xterm.js client + ttyd server (inside Cloudflare Sandbox containers)
- **State**: Durable Objects (SessionStateDO, TabStateDO)
- **Infrastructure**: Alchemy (infrastructure as code in `alchemy.run.ts`)

### Key Components

**Alchemy Configuration** (`alchemy.run.ts`):
- `Container`: Builds sandbox image from Dockerfile with pre-installed agents
- `Worker`: Hono API at api.myfilepath.com with DO bindings
- `SvelteKit`: Frontend app at myfilepath.com

**Worker** (`worker/`):
- `index.ts`: Hono routes for session/terminal management, WebSocket proxying to sandbox
- `session-state.ts`: SessionStateDO - manages tabs, agents, passwords, WebSocket broadcast
- `tab-state.ts`: TabStateDO - per-tab state (tmux window index, working dir)

**Frontend** (`src/`):
- `routes/+page.svelte`: Agent selection landing page
- `routes/terminal/[id]/+page.svelte`: Terminal UI with tabs, xterm.js, WebSocket connections
- `lib/agents.ts`: Agent definitions (id, name, command, envKey, install script)

### Terminal Architecture

Each session gets a Cloudflare Sandbox container with:
1. ttyd server on port 7681 (only exposed port)
2. tmux for multi-window terminal multiplexing
3. Pre-installed CLI agents (baked into Docker image)

WebSocket flow: Browser → Worker → Sandbox (ttyd) → tmux window

Cross-browser sync: All clients connect to same ttyd/tmux session. Tab state synced via SessionStateDO WebSocket broadcast.

### Session Lifecycle

1. POST /session → Create session in SessionStateDO, store agents
2. POST /terminal/:id/start → Initialize sandbox, set env vars
3. POST /terminal/:sessionId/:tabId/start → Create tmux window for tab
4. GET /terminal/:sessionId/:tabId/ws → WebSocket upgrade to sandbox ttyd

### Environment Variables

Required in `.env` for agents:
- `ANTHROPIC_API_KEY` - Claude Code (required if claude agent selected)
- `OPENAI_API_KEY` - Codex
- `CURSOR_API_KEY` - Cursor
- `FACTORY_API_KEY` - Droid

## Coding Conventions

- Svelte 5 runes: `$state`, `$derived`, `$effect` (not Svelte 4 stores)
- Minimal abstractions - keep code simple and direct
- Terminal sessions are the core product; sharing is first-class
