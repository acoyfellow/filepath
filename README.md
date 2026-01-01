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
- **Terminal**: xterm.js + ttyd (per-connection isolation)
- **State**: Durable Objects (SessionStateDO, TabStateDO)
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

✅ **Multi-agent support** - Claude, Codex, Cursor, OpenCode, Droid
✅ **Isolated tabs** - Each tab has independent shell
✅ **Persistent state** - Tabs/sessions survive refreshes
✅ **Real-time sync** - WebSocket-based cross-client updates
✅ **URL sharing** - No auth needed, share via link
✅ **Dump/fork** - Export tab state, clone to new sessions

## Architecture Details

### Session Lifecycle

```
User selects agents
    ↓
POST /session → Create SessionStateDO
    ↓
Create Cloudflare Sandbox instance
    ↓
Install agents (Claude, Codex, etc)
    ↓
User creates tabs
    ↓
Each tab → Create TabStateDO + WebSocket to ttyd
    ↓
Each WebSocket = independent bash shell
```

### State Management

- **SessionStateDO**: Tab list, active tab, agents, metadata
- **TabStateDO**: Tab-specific state (can be dumped/forked)
- **Sandbox**: Actual shell instances + agent installations

### Terminal Isolation

Each WebSocket connection to ttyd gets its own shell instance. No tmux window management needed—ttyd handles per-connection isolation natively.

## Development

### File Structure

```
src/
├── routes/
│   ├── +page.svelte          # Agent selection
│   ├── terminal/[id]/+page.svelte  # Terminal UI
│   └── api/
│       └── terminal/          # Terminal endpoints
├── lib/
│   ├── agents.ts             # Agent definitions
│   ├── types.ts              # Shared types
│   └── components/           # Reusable components
worker/
├── index.ts                  # Hono app + endpoints
├── session-state.ts          # SessionStateDO
└── tab-state.ts              # TabStateDO
```

### Key Endpoints

- `POST /session` - Create session
- `POST /terminal/:id/start` - Initialize session
- `GET /terminal/:sessionId/:tabId/ws` - WebSocket (ttyd)
- `POST /terminal/:sessionId/dump` - Export session state
- `POST /terminal/fork` - Clone session

## Constraints

- **Single port**: Cloudflare Sandbox exposes only 7681 (ttyd server)
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
