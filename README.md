# filepath

**Terminal session sharing platform with AI coding agents**

Create, share, and collaborate on isolated terminal sessions with Claude, Codex, Cursor, OpenCode, and Droid.

## What It Does

1. **Multi-agent selection** → Pick one or more AI coding agents
2. **Persistent sessions** → Terminal sessions with multiple isolated tabs
3. **Real-time sharing** → Collaborate via URL, state syncs across clients
4. **Isolated tabs** → Each tab has independent shell, working dir, env vars
5. **Dump & fork** → Save tab state, clone to new sessions

## Architecture

- **Frontend**: SvelteKit + Svelte 5 + Tailwind CSS
- **Backend**: Cloudflare Workers (Hono) + Sandbox SDK
- **Terminal**: xterm.js + WebSocket via TabBroadcastDO + ttyd (one instance per tab in separate Sandbox containers)
- **State**: Durable Objects (SessionStateDO, TabStateDO, TabBroadcastDO)
- **Deploy**: Alchemy (infrastructure as code)

## Setup

### Prerequisites
- Node.js / Bun
- Cloudflare account (for Sandbox)
- Alchemy CLI

### Install

```bash
bun install
```

### Environment

Create `.env` with your API keys (optional, defaults to empty):

```
ANTHROPIC_API_KEY=sk-...
OPENAI_API_KEY=sk-...
CURSOR_API_KEY=...
FACTORY_API_KEY=...
```

### Run Dev

```bash
bun run dev
```

Visit `http://localhost:5173`

## Usage

1. Select agents from landing page
2. Click "Launch Terminal"
3. Type agent commands:
   ```bash
   claude    # Start Claude Code
   codex     # Start OpenAI Codex
   cursor-agent  # Start Cursor
   opencode  # Start OpenCode
   droid     # Start Factory Droid
   ```
4. Create new tabs with `+` button
5. Share session via URL
6. Dump/fork tabs to save state

## Key Features

- **Multi-agent support** - Claude, Codex, Cursor, OpenCode, Droid
- **Isolated tabs** - Each tab has independent shell
- **Persistent state** - Tabs/sessions survive refreshes
- **Real-time sync** - WebSocket-based cross-client updates
- **URL sharing** - No auth needed, share via link
- **Dump/fork** - Export tab state, clone to new sessions

## Ralph loop (automation)

- State lives in `AGENTS.md` and `scripts/ralph/`
- Stories are tracked in `scripts/ralph/prd.json` (one story per run)
- Guard: `bash scripts/ralph/guard.sh scripts/ralph/constraints.json`
- Workflow: `.github/workflows/ralph.yml`
- Trigger manually from GitHub Actions (workflow_dispatch) or by bot pushes to `AGENTS.md`/`scripts/ralph/**`
- Secrets expected: `RALPH_PAT` (push), `OPENCODE_API_KEY` (agent), and `OPENCODE_INSTALL_SHA256` (installer checksum)

## Architecture Details

### Session Lifecycle

```
User selects agents
    ↓
POST /session → Create SessionStateDO
    ↓
User creates tabs
    ↓
POST /terminal/:sessionId/:tabId/start → Create Sandbox container for tab
    ↓
Each tab → Sandbox container + ttyd on port 7681
    ↓
GET /terminal/:sessionId/:tabId/ws → TabBroadcastDO manages WebSocket connections
    ↓
TabBroadcastDO connects to ttyd and broadcasts to all clients
```

### State Management

- **SessionStateDO**: Tab list, active tab, agents, metadata, WebSocket connections for tab state sync
- **TabStateDO**: Tab-specific state (can be dumped/forked)
- **TabBroadcastDO**: WebSocket connection management per tab, broadcasts ttyd output to all clients
- **Sandbox**: Container instances (one per tab), each runs ttyd + bash shell

### Terminal Isolation

**Critical Constraint**: Cloudflare Sandbox only allows connections to ports declared via `EXPOSE` in the Dockerfile. We have `EXPOSE 7681` - that's the only port available.

**Architecture**: Each tab gets its own Cloudflare Sandbox container instance (identified by `${sessionId}:${tabId}`). Each container runs a single `ttyd` process on port 7681 with a bash shell. Multiple browsers connecting to the same tab share the same ttyd instance via `TabBroadcastDO`, which broadcasts ttyd output to all connected clients (cross-browser sync).

```
Browser → Worker → TabBroadcastDO → Sandbox Container (tab 1) → ttyd:7681
Browser → Worker → TabBroadcastDO → Sandbox Container (tab 2) → ttyd:7681
```

**Key Points**:
- Each tab = one Sandbox container = one ttyd process on port 7681
- TabBroadcastDO manages WebSocket connections and broadcasts ttyd output to all clients
- Agents are pre-installed in the Docker image, not installed at runtime

## Development

### File Structure

```
src/
├── routes/
│   ├── +page.svelte                    # Agent selection
│   └── terminal/[id]/
│       ├── +page.svelte                 # Terminal UI with tabs
│       └── tab/+page.svelte             # Individual tab view
├── lib/
│   ├── agents.ts                        # Agent definitions
│   ├── api-utils.ts                     # API helper functions
│   └── types.ts                         # Shared types
worker/
├── index.ts                              # Hono app + endpoints
├── session-state.ts                      # SessionStateDO
├── tab-state.ts                          # TabStateDO
└── tab-broadcast.ts                      # TabBroadcastDO (WebSocket management)
```

### Key Endpoints

- `POST /session` - Create session
- `POST /terminal/:id/start` - Initialize session
- `GET /terminal/:sessionId/:tabId/ws` - WebSocket (ttyd)
- `POST /terminal/:sessionId/dump` - Export session state
- `POST /terminal/fork` - Clone session

## Constraints

- **Single exposed port**: Cloudflare Sandbox only allows connections to ports declared via `EXPOSE` in the Dockerfile. We expose only port 7681. All other ports (7682+) are internal-only and cannot be accessed directly from the worker. This is why we use a WebSocket proxy on 7681 to route to internal ttyd instances.
- **No auth yet**: URL-based sharing (password protection code ready)
- **Session TTL**: 10 minutes (configurable)

## Design Principles

- **Simple > clever** - Minimal abstractions
- **Terminal-first** - The terminal is the primary interface
- **Shareable by default** - Sessions designed for collaboration
- **Agent-agnostic** - Support multiple AI agents

## Deployment

### Local Development

```bash
bun run dev
```

### Production (myfilepath.com)

```bash
bun run deploy
```

Uses Alchemy for infrastructure. Configure in `alchemy.run.ts`.

## Contributing

- Svelte 5 with runes (`$state`, `$derived`)
- Minimal code, avoid unnecessary abstractions
- Terminal sessions are the core product
- Sharing is a first-class feature

## License

MIT
