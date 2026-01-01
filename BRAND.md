# filepath Brand & Product Direction

## Brand Identity

**Name:** `filepath`

**Domain:** `myfilepath.com`

**Status:** Alpha - Terminal session sharing platform with isolated tabs and AI coding agents

## Core Concept

`filepath` is a platform for creating, managing, and sharing terminal sessions with AI coding agents. The brand name doesn't need a literal file-path connection—it works as a clean, technical brand identity.

### Key Principles
- **Simple > Clever** - Working simple code beats complex abstractions
- **Terminal-first** - The terminal is the primary interface
- **Shareable by default** - Sessions are designed to be shared via URL
- **Agent-agnostic** - Supports multiple AI coding agents (Claude, Codex, Cursor, OpenCode, Droid)

## Product Features

### Current Capabilities
1. **Multi-Agent Support**
   - Select one or more AI coding agents per session
   - Agents installed on-demand in isolated sandboxes
   - Each agent has its own CLI command and documentation

2. **Terminal Sessions**
   - Persistent terminal sessions via Cloudflare Sandbox
   - Multiple isolated tabs per session (each WebSocket = independent shell)
   - Real-time WebSocket communication via ttyd
   - Tab state persists in Durable Objects
   - Sessions survive browser refresh and device changes

3. **Sharing**
   - Sessions shareable via URL
   - State synchronized across all connected clients
   - No authentication required (URL-based access)

4. **Session Management**
   - Tab names editable (double-click to rename)
   - Tab state stored in Durable Objects
   - Session metadata (agents, creation time) stored server-side

### Technical Architecture
- **Frontend:** SvelteKit + Svelte 5 + Tailwind CSS
- **Backend:** Cloudflare Workers + Hono
- **Terminal:** xterm.js + ttyd (per-connection isolation)
- **State:** Durable Objects (SessionStateDO, TabStateDO)
- **Deploy:** Alchemy (infrastructure as code)

## Design Direction

### Visual Identity
- **Typography:** Monospace font for brand name (`filepath`)
- **Color Scheme:** Dark theme (black/gray) with accent colors
- **Icons:** Lucide icons (not Flowbite)
- **Style:** Minimal, terminal-inspired, developer-focused

### UI Patterns
- **Homepage:** Agent selection cards with checkboxes
- **Terminal Page:** 
  - Top nav: Session ID, agent avatars, share button
  - Tab bar: Editable tab names, close buttons, new tab button
  - Terminal area: Full-screen xterm.js terminal

### Brand Voice
- Concise, technical, pragmatic
- No marketing fluff
- Developer-to-developer communication

## Brand Name Considerations

**Current Approach:** `filepath` as a clean brand name without forcing literal file-path connections.

**Potential Conceptual Frameworks:**
1. **"Path" as workflow/journey** - The path you take through development
2. **"Path" as sequence** - The path of commands/work you share
3. **Pure brand name** - No forced connection, just a technical-sounding name

**Decision:** Keep it simple. Don't force conceptual connections that don't naturally fit terminal sessions.

## Future Direction

### Implemented Features
- **Tab Persistence** - Dump/fork tabs to save state across sessions
- **Isolated Tabs** - Each tab has independent shell, working directory, env vars

### Planned Features
- **Session Export** - Download session state as JSON
- **Session Import** - Restore from exported state
- **Password Protection** - Lightweight password for shared sessions (code ready)

### Open Questions
- How to meaningfully connect "filepath" concept with terminal sessions?
- Should workspace/path organization be a feature, or keep it simple?
- What makes a terminal session "permanent" vs temporary?

## Technical Constraints & Design Decisions

- **Single Port:** Cloudflare Sandbox exposes only port 7681 (ttyd server)
- **State:** Durable Objects for persistence (SessionStateDO, TabStateDO)
- **Sync:** WebSocket-based real-time synchronization
- **Access:** URL-based sharing, no auth *yet* (password feature planned)
- **Isolation:** Each WebSocket connection = independent shell instance

## Codebase Conventions

- **Svelte 5** with runes (`$state`, `$derived`, `$effect`)
- **Avoid `$effect`** when possible (user preference)
- **Minimal code** - Less is more
- **Tailwind CSS** for styling
- **No emojis** in code
- **Pragmatic over perfect** - Ship working code, iterate

## Agent Integration

When working on this codebase:
- Use Svelte 5 patterns
- Keep code minimal and pragmatic
- Don't add unnecessary abstractions
- Terminal sessions are the core product
- Sharing is a first-class feature
- Agent selection is flexible (multi-select)

## Brand Assets

- **Logo:** Currently text-based (`filepath` in monospace)
- **Domain:** `myfilepath.com`
- **Colors:** Dark theme (black/gray) with terminal aesthetic

