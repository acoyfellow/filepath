# NORTHSTAR.md

> The definitive plan for filepath. Everything an agent needs to build this.

## What filepath is

filepath is a web UI for orchestrating trees of AI coding agents running in containers on Cloudflare.

You open filepath. You create a session. You spawn an agent -- pick its type (claude-code, cursor, codex, whatever), pick its model, give it a name. You send it a message. It starts working in an isolated container with your repo cloned. You watch it work through rich chat -- tool calls, file writes, commits, all inline. It spawns child agents. The tree grows. You click any node, see its conversation. You steer with messages. You close your laptop, open your phone, same state. That's it.

**The tree is the product.** It visualizes hierarchy, communication topology, and status at a glance. Every node is the same primitive. There is no orchestrator/worker distinction in the UI -- an orchestrator is just an agent that has children.

**Chat is the only view.** No terminal. No embedded agent UI. Rich inline message blocks (tool calls, diffs, commits, worker status pills) make a headless agent feel headed.

**Agents are CLI tools in containers.** If your agent has a CLI, it runs on filepath. The built-in agents (shelley, claude-code, cursor, codex, etc.) are reference implementations of a simple protocol. BYO = bring your Dockerfile.

**This repo is open source.** The infrastructure for running CLI agents on Cloudflare in containers, orchestrating them as trees, and visualizing their work -- that's the open-source value. The hosted version at myfilepath.com is the product with a price tag.

## The three layers

```
Layer 3: UI              Tree + rich chat. The product surface. What users see.
Layer 2: Orchestration   Worker loops, handoffs, health checks, memory. docs.coey.dev translated to web.
Layer 1: Infrastructure  DO-per-agent, CF Sandbox containers, typed RPC, session sim. Open-source core.
```

We build bottom-up but prioritize top-down. Layer 1 exists (partially). Layer 3 is the immediate priority because it makes everything visible.

## Core ethos

- **Simplicity always wins.** Fewer clicks, fewer fields, fewer concepts. If it doesn't need to be there, it isn't.
- **Every agent is the same primitive.** The tree defines topology, not a type system.
- **Harness and model are liquid config.** Dropdowns at spawn, tags in a header. When these layers get abstracted away, you delete two `<span>` tags. Nothing else changes.
- **Chat-first (inspired by exe.dev).** The primary interface is conversation with the agent, not watching it work.
- **Testing-first (gateproof).** Gates define "done" before implementation. Agents can't break what exists.
- **Build the hard/right way first.** BYO agent protocol before built-in convenience. Tree schema before flat workarounds.

## Inspiration

- **docs.coey.dev** -- Orchestration philosophy. Worker loops, handoffs, health checks, Deja memory, conductor-doesn't-interfere. filepath is the web UI for this workflow.
- **Workflowy** -- Tree UX. Every bullet is the same thing, infinitely nestable. Tree on left = outliner. Panel on right = zoom into the selected node.
- **joelhooks/atproto-agent-network** -- Infrastructure patterns. DO-per-agent, Zod-typed message schemas, encrypted memory, CF AI Gateway routing. Parallel train of thought on the same stack.
- **diataxis.fr** -- Documentation structure. Tutorials, how-tos, reference, explanation.
- **gateproof.dev** -- Testing philosophy. Define expected behavior, then verify it. Agents fall into building features.

---

## The filepath Agent Protocol (FAP)

The protocol that every agent speaks. Defined as Zod schemas. Validated at boundaries. The source of truth.

### Container contract

The container receives:

| Input | Mechanism | Description |
|-------|-----------|-------------|
| Repo | Filesystem | Cloned at `/workspace` before agent starts |
| Task | Env var | `FILEPATH_TASK` -- the initial task (first user message) |
| API key | Env var | `FILEPATH_API_KEY` -- for LLM calls via OpenRouter/CF AI Gateway |
| Agent ID | Env var | `FILEPATH_AGENT_ID` -- this agent's node ID |
| Session ID | Env var | `FILEPATH_SESSION_ID` -- parent session ID |
| User messages | stdin | NDJSON stream -- one JSON object per line |

The container emits to stdout:

```
NDJSON -- one JSON object per line, each validated against AgentEvent schema
```

### Event types

```typescript
// filepath-protocol/events.ts
import { z } from "zod";

export const TextEvent = z.object({
  type: z.literal("text"),
  content: z.string(),
});

export const ToolEvent = z.object({
  type: z.literal("tool"),
  name: z.string(),
  path: z.string().optional(),
  status: z.enum(["start", "done", "error"]),
  output: z.string().optional(),
});

export const CommandEvent = z.object({
  type: z.literal("command"),
  cmd: z.string(),
  status: z.enum(["start", "done", "error"]),
  exit: z.number().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
});

export const CommitEvent = z.object({
  type: z.literal("commit"),
  hash: z.string(),
  message: z.string(),
});

export const SpawnEvent = z.object({
  type: z.literal("spawn"),
  name: z.string(),
  agent: z.string(),
  model: z.string(),
  task: z.string().optional(),
});

export const WorkersEvent = z.object({
  type: z.literal("workers"),
  workers: z.array(z.object({
    name: z.string(),
    status: z.enum(["idle", "thinking", "running", "done", "error"]),
  })),
});

export const StatusEvent = z.object({
  type: z.literal("status"),
  state: z.enum(["idle", "thinking", "running", "done", "error"]),
  context_pct: z.number().min(0).max(1).optional(),
});

export const HandoffEvent = z.object({
  type: z.literal("handoff"),
  summary: z.string(),
});

export const DoneEvent = z.object({
  type: z.literal("done"),
  summary: z.string().optional(),
});

export const AgentEvent = z.discriminatedUnion("type", [
  TextEvent,
  ToolEvent,
  CommandEvent,
  CommitEvent,
  SpawnEvent,
  WorkersEvent,
  StatusEvent,
  HandoffEvent,
  DoneEvent,
]);

export type AgentEvent = z.infer<typeof AgentEvent>;
```

### Input messages (stdin)

```typescript
export const UserMessage = z.object({
  type: z.literal("message"),
  from: z.enum(["user", "parent", "system"]),
  content: z.string(),
});

export const SignalMessage = z.object({
  type: z.literal("signal"),
  action: z.enum(["stop", "pause", "resume"]),
});

export const AgentInput = z.discriminatedUnion("type", [
  UserMessage,
  SignalMessage,
]);

export type AgentInput = z.infer<typeof AgentInput>;
```

### Protocol → UI mapping

| Protocol event | Chat renders as |
|---|---|
| `text` | Prose message (agent bubble) |
| `tool` | Collapsible tool block (name, path, expandable output) |
| `command` | Collapsible command block (cmd, exit code, stdout/stderr) |
| `commit` | Commit log entry (accent hash + message) |
| `spawn` | Creates child node in tree + spawn message in chat |
| `workers` | Clickable worker pill strip (status dots, navigate on click) |
| `status` | Updates status dot in tree (pulse animation if active) |
| `handoff` | Handoff message block, triggers next session |
| `done` | Marks node green in tree, static dot |

### Architecture: DO as relay

```
Browser ←WebSocket→ ChatAgent DO ←stdin/stdout→ Container Process (CLI agent)
                         ↓
                    D1 (persistence)
                    Message history
                    Tree state
```

The ChatAgent DO does NOT call LLMs. It is a **relay/conductor**:
1. Receives user messages from frontend via WebSocket
2. Forwards them to container process via stdin (NDJSON)
3. Reads container stdout, parses and validates NDJSON events
4. Persists events as chat message history
5. Streams events to frontend via WebSocket
6. Handles lifecycle: start process, monitor health, detect context limits, trigger handoff

### Built-in agents (reference BYO implementations)

Each built-in agent is a Docker image with an adapter that wraps the CLI tool:

| Agent | CLI tool | What the adapter does |
|-------|----------|----------------------|
| shelley | filepath-native (Node.js) | Our own agent. Calls OpenRouter directly, emits FAP events natively. Reference implementation. |
| pi | filepath-native (Node.js) | Same as shelley, research-focused system prompt and personality. |
| claude-code | `claude` CLI | Wraps claude CLI in agent mode, parses markdown output → FAP events |
| codex | `codex` CLI | Wraps codex CLI, parses output → FAP events |
| cursor | `cursor` CLI | Wraps cursor CLI agent mode, parses output → FAP events |
| amp | `amp` CLI | Wraps Sourcegraph amp CLI, parses output → FAP events |
| custom (BYO) | User's Dockerfile | User implements FAP directly or provides their own adapter |

### Billing

LLM calls route through filepath-provided API keys → CF AI Gateway → OpenRouter. filepath meters at the gateway level. The agent doesn't self-report usage. Gateway logs = billing source of truth. Works for BYO agents too (they use filepath's key).

---

## Schema (nuke and rebuild)

Delete `migrations/` folder. Nuke prod D1. Fresh schema from zero.

### Keep (auth tables)

`user`, `session` (auth), `account`, `verification`, `passkey`, `apikey` -- these stay as-is. Better-auth depends on them.

### Replace

`multi_agent_session` and `agent_slot` get replaced with a tree-native design:

```typescript
// New tables

export const agentSession = sqliteTable(
  "agent_session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    gitRepoUrl: text("git_repo_url"),
    status: text("status").notNull().default("draft"),
    // 'draft' | 'running' | 'paused' | 'stopped' | 'error'
    rootNodeId: text("root_node_id"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    lastBilledAt: integer("last_billed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("agent_session_user_id_idx").on(table.userId),
    index("agent_session_status_idx").on(table.status),
  ],
);

export const agentNode = sqliteTable(
  "agent_node",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => agentSession.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    // Self-referential. NULL = root node. FK enforced at app level.
    name: text("name").notNull(),
    agentType: text("agent_type").notNull(),
    // 'shelley' | 'pi' | 'claude-code' | 'codex' | 'cursor' | 'amp' | 'custom'
    model: text("model").notNull(),
    status: text("status").notNull().default("idle"),
    // 'idle' | 'thinking' | 'running' | 'done' | 'error'
    config: text("config").notNull().default("{}"),
    // JSON: { systemPrompt?, envVars?, maxTokens? }
    containerId: text("container_id"),
    sortOrder: integer("sort_order").notNull().default(0),
    tokens: integer("tokens").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("agent_node_session_id_idx").on(table.sessionId),
    index("agent_node_parent_id_idx").on(table.parentId),
    index("agent_node_status_idx").on(table.status),
  ],
);
```

### Key differences from old schema

| Old (`agent_slot`) | New (`agent_node`) | Why |
|---|---|---|
| `role: 'orchestrator' \| 'worker'` | `parentId: text \| null` | Tree structure via self-reference. No role distinction. |
| Flat list under session | Nested tree under session | Workflowy-inspired hierarchy |
| `orchestratorSlotId` on session | `rootNodeId` on session | Root node = the first agent spawned |
| No ordering | `sortOrder` | Siblings have deterministic order in tree |
| No token tracking | `tokens` | Display in panel header |
| `model` inside `config` JSON | `model` as top-level column | Queried/displayed frequently, deserves its own column |

---

## UI Components (Svelte 5)

### Layout: `/session/[id]/+page.svelte`

```
+------------------------------------------+
| [logo] filepath              [theme]     |  <- TopBar.svelte
+----------+-------------------------------+
| AGENTS   | [dot] agent-name  Running     |  <- AgentPanel.svelte (header)
|          |        claude-code  sonnet-4.5 |
| > root   |                               |
|   > plan |  (rich chat messages)         |  <- ChatView.svelte
|     db   |                               |
|     api  |                               |
|   > impl |                               |
|     jwt  |                               |
|     auth |                               |
|          +-----------------------+
| [+ spawn]| [input] [send]       |  <- ChatInput.svelte
+------------------------------------------+
  ^                ^
  AgentTree.svelte  AgentPanel.svelte
```

### Component breakdown

| Component | File | Responsibility |
|-----------|------|----------------|
| `TopBar.svelte` | `src/lib/components/session/TopBar.svelte` | Logo + "filepath" + theme toggle. Nothing else. |
| `AgentTree.svelte` | `src/lib/components/session/AgentTree.svelte` | Recursive tree sidebar. Resizable (150-360px). Spawn button at bottom. |
| `TreeNode.svelte` | `src/lib/components/session/TreeNode.svelte` | Single tree node. Chevron + status dot + name + completion count. Click = select. |
| `AgentPanel.svelte` | `src/lib/components/session/AgentPanel.svelte` | Header (dot, name, status, agent tag, model tag, tokens) + ChatView. Switches based on selected node. |
| `ChatView.svelte` | `src/lib/components/session/ChatView.svelte` | Scrollable message list + typing indicator. Auto-scrolls on new messages. Empty state. |
| `ChatInput.svelte` | `src/lib/components/session/ChatInput.svelte` | Monospace input + accent send button. |
| `TextMessage.svelte` | `src/lib/components/chat/TextMessage.svelte` | Prose with inline code (backtick parsing). User = right-aligned accent bubble. Agent = left-aligned, no bubble. |
| `ToolBlock.svelte` | `src/lib/components/chat/ToolBlock.svelte` | Collapsible block. Checkmark + name + path + expandable output. |
| `CommandBlock.svelte` | `src/lib/components/chat/CommandBlock.svelte` | Same as ToolBlock but for shell commands. Shows exit code. |
| `WorkerPills.svelte` | `src/lib/components/chat/WorkerPills.svelte` | Horizontal pill strip. Status dot + name per pill. **Click navigates to that node in tree.** |
| `CommitLog.svelte` | `src/lib/components/chat/CommitLog.svelte` | Stacked rows. Git icon + count header. Accent hash + message per row. |
| `TypingIndicator.svelte` | `src/lib/components/chat/TypingIndicator.svelte` | Three bouncing dots. Shown when agent status is running/thinking. |
| `StatusDot.svelte` | `src/lib/components/shared/StatusDot.svelte` | Colored dot with optional pulse animation. Used everywhere. |
| `SpawnModal.svelte` | `src/lib/components/session/SpawnModal.svelte` | Name (auto-gen + reroll) + agent type (pills) + model (searchable dropdown) + spawn button. |

### Theming

CSS custom properties on `:root` (light, default) and `.dark` class (dark, toggled):

```css
:root {
  --bg: #ffffff; --bg2: #f9f9fb; --bg3: #f4f4f6;
  --b1: #e8e8ec; --b2: #dddde1;
  --t1: #1a1a1e; --t2: #3f3f46; --t3: #52525b;
  --t4: #71717a; --t5: #a1a1aa; --t6: #d4d4d8;
  --accent: #818cf8;
}
.dark {
  --bg: #09090b; --bg2: #0a0a0d; --bg3: #0c0c0f;
  --b1: #141417; --b2: #1a1a1e;
  --t1: #e4e4e7; --t2: #a1a1aa; --t3: #71717a;
  --t4: #3f3f46; --t5: #27272a; --t6: #1e1e22;
  --accent: #818cf8;
}
```

Fonts: JetBrains Mono (agents, code, metadata), Outfit (UI chrome). Almost everything is mono.

### Status system

| Status | Color | Dot | Meaning |
|--------|-------|-----|---------|
| idle | `#52525b` (zinc) | Static | Not started or waiting |
| thinking | `#f59e0b` (amber) | Pulsing | Reasoning, planning |
| running | `#818cf8` (indigo) | Pulsing | Executing |
| done | `#22c55e` (green) | Static | Completed |
| error | `#ef4444` (red) | Static | Failed |

### Spawn modal

Minimal. Not a wizard.

- **Name:** Auto-generated (`adjective-number`) + dice reroll button
- **Agent type:** Pill buttons (shelley, pi, claude-code, codex, cursor, amp, custom)
- **Model:** Searchable dropdown. Pulls available models from OpenRouter API dynamically (cached). Grouped by provider.
- **Spawns as child** of currently selected tree node (or root if nothing selected)
- **No task field.** The first chat message IS the task.
- **Remembers** last-used agent + model

### Session creation (one action)

"New session" button on dashboard → modal with:
- Session name (auto-generated, editable)
- Git repo URL (optional)
- Then immediately: spawn modal for root agent

One flow, two modals, you're in the session view working. Minimal friction.

---

## Agent catalog

```typescript
const AGENTS = {
  shelley: {
    name: "Shelley",
    description: "Full-stack engineering agent. filepath-native reference implementation.",
    icon: "shell", // lucide icon name
    defaultModel: "claude-sonnet-4",
  },
  pi: {
    name: "Pi",
    description: "Research and analysis. Deep dives into docs, APIs, codebases.",
    icon: "search",
    defaultModel: "claude-sonnet-4",
  },
  "claude-code": {
    name: "Claude Code",
    description: "Anthropic's agentic coding tool. Complex multi-file changes.",
    icon: "bot",
    defaultModel: "claude-sonnet-4",
  },
  codex: {
    name: "Codex",
    description: "OpenAI's coding agent. Strong at Python, scripting, data.",
    icon: "scroll",
    defaultModel: "o3",
  },
  cursor: {
    name: "Cursor",
    description: "Cursor's agent mode via CLI. IDE-grade code intelligence.",
    icon: "mouse-pointer",
    defaultModel: "claude-sonnet-4",
  },
  amp: {
    name: "Amp",
    description: "Sourcegraph's agent. Large codebase navigation, cross-repo changes.",
    icon: "zap",
    defaultModel: "claude-sonnet-4",
  },
  custom: {
    name: "Custom",
    description: "Bring your own agent. Dockerfile that speaks the filepath protocol.",
    icon: "box",
    defaultModel: "claude-sonnet-4",
  },
} as const;
```

---

## Execution phases

### Phase 0: Foundation

**0.1 -- Protocol package**
- Create `src/lib/protocol/` with Zod schemas for all event types
- Export `AgentEvent`, `AgentInput`, and all individual types
- This is the single source of truth. DO validation, frontend rendering, and agent SDK all import from here.
- Gate: `import { AgentEvent } from '$lib/protocol'` compiles. All event types parse sample data. Zod schemas round-trip.

**0.2 -- Schema migration**
- Delete `migrations/` folder
- Replace `multiAgentSession` + `agentSlot` with `agentSession` + `agentNode` in `src/lib/schema.ts`
- Update all relations
- Generate fresh migration with `drizzle-kit generate`
- Nuke prod D1 and apply
- Gate: `drizzle-kit generate` succeeds. Schema types compile. Fresh DB accepts inserts for session + tree of nodes.

**0.3 -- Update prd.ts and gates**
- Replace old gate files with new ones matching the new architecture
- Stories map to the execution phases below
- Gate: `bun run prd.ts` runs and reports story status correctly.

### Phase 1: Session View UI (the product)

**1.1 -- StatusDot.svelte**
- Shared component. Colored dot with optional pulse animation via CSS.
- Props: `status`, `size`
- Gate: Component renders all 5 statuses. Pulse animation plays for running/thinking.

**1.2 -- TreeNode.svelte**
- Single tree node row. Chevron (if has children) + StatusDot + name + completion count.
- Props: `node`, `selectedId`, `depth`
- Events: `select`, `toggle`
- Completion count: `done/total` computed from leaf descendants.
- Gate: Component renders nested demo data. Click selects. Chevron toggles collapse.

**1.3 -- AgentTree.svelte**
- Recursive tree sidebar. Maps `agentNode[]` to tree structure.
- Resizable width (150-360px) via drag handle.
- "AGENTS" header. Spawn button at bottom.
- Gate: Tree renders 3-level demo hierarchy. Resize works. Selection callback fires.

**1.4 -- TextMessage.svelte**
- User messages: right-aligned, accent bubble, rounded corners.
- Agent messages: left-aligned, no bubble.
- Inline code via backtick parsing.
- Gate: Both user and agent messages render. Inline code renders as `<code>`.

**1.5 -- ToolBlock.svelte + CommandBlock.svelte**
- Collapsible blocks. Click header to expand/collapse output.
- Checkmark icon + name + path in header. Pre-formatted output in body.
- Gate: Block renders collapsed. Click expands. Output visible.

**1.6 -- WorkerPills.svelte**
- Horizontal pill strip. Each pill: StatusDot + name.
- Click dispatches navigation event (agent name → tree selection).
- Gate: Pills render with correct status colors. Click fires nav event with agent name.

**1.7 -- CommitLog.svelte**
- Header: git icon + count. Rows: accent-colored hash + message.
- Gate: Renders list of commits. Hash uses accent color.

**1.8 -- TypingIndicator.svelte**
- Three dots with staggered bounce animation.
- Gate: Animation plays. Dots are visible.

**1.9 -- ChatView.svelte**
- Scrollable message list. Renders all message types based on `type` discriminator.
- Auto-scrolls to bottom on new messages.
- Empty state: chat icon + "Send a message to activate this agent".
- Gate: All message types render correctly from demo data. Auto-scroll works. Empty state shows when no messages.

**1.10 -- ChatInput.svelte**
- Monospace input + indigo send button with arrow icon.
- Enter to send, Shift+Enter for newline.
- Gate: Input accepts text. Send fires with message content. Enter submits.

**1.11 -- AgentPanel.svelte**
- Header: StatusDot + name + status label (colored) + agent type tag + model tag + token count.
- Body: ChatView.
- Footer: ChatInput.
- Switches content based on `selectedNodeId`.
- Gate: Header shows correct agent info. Chat loads for selected agent. Switching nodes switches chat.

**1.12 -- SpawnModal.svelte**
- Name input with auto-gen + reroll.
- Agent type pill buttons.
- Model searchable dropdown.
- Cancel + Spawn buttons.
- Gate: Modal opens/closes. Name rerolls. Agent selection highlights. Model dropdown filters. Spawn returns { name, agent, model }.

**1.13 -- TopBar.svelte**
- Logo (filepath terminal icon) + "filepath" text + theme toggle button (sun/moon).
- Theme toggle adds/removes `.dark` class on root.
- Gate: Logo renders. Theme toggle switches between light/dark. CSS variables change.

**1.14 -- Theme CSS**
- CSS custom properties for light and dark modes.
- All color references use variables.
- Font imports (JetBrains Mono, Outfit).
- Animations (pulse, bounce).
- Scrollbar styling.
- Gate: Light mode default. Dark mode togglable. All components respect theme variables.

**1.15 -- Session page assembly**
- Wire all components together in `/session/[id]/+page.svelte`.
- Replace the current 3-panel layout entirely.
- New layout: TopBar + AgentTree (left) + AgentPanel (right).
- State: `selectedNodeId`, tree data, spawn modal open/close.
- Gate: Full session page renders with demo data. Tree selection drives panel. Spawn modal creates nodes. Theme toggles. All message types visible.

### Phase 2: Backend -- API + DO rewiring

**2.1 -- Session CRUD (new schema)**
- Update `/api/session/multi` endpoints to use `agentSession` + `agentNode` tables.
- Create session endpoint: creates session + optionally first root node.
- Get session endpoint: returns session + full tree (nodes with parent-child structure).
- Delete session endpoint: cascading delete.
- Gate: Create session → get session returns tree structure. Delete cascades.

**2.2 -- Node CRUD (spawn/status/delete)**
- POST `/api/session/[id]/node` -- create node (spawn agent as child of parent).
- PATCH `/api/session/[id]/node/[nodeId]` -- update status, config.
- DELETE `/api/session/[id]/node/[nodeId]` -- delete node + children.
- GET `/api/session/[id]/tree` -- full tree with statuses.
- Gate: Spawn node → appears in tree. Update status → reflected. Delete cascades children.

**2.3 -- ChatAgent DO as relay**
- Refactor `chat-agent.ts`: remove direct LLM calling.
- DO receives messages via WebSocket, forwards to container process stdin.
- DO reads container stdout, parses NDJSON events via `AgentEvent.safeParse()`.
- DO persists validated events as message history.
- DO streams events to frontend via WebSocket.
- Gate: Send message → DO forwards to container → container emits event → DO streams to frontend → frontend renders.

**2.4 -- Container lifecycle**
- Start: create container, clone repo, set env vars, start agent process.
- Monitor: read stdout stream, detect status changes, update `agentNode.status` in D1.
- Stop: send stop signal via stdin, kill container after grace period.
- Gate: Start session → containers spin up → agents receive task → stdout streams events. Stop → containers killed.

**2.5 -- Dynamic spawn from agents**
- When container emits `SpawnEvent`, DO creates child `agentNode` in D1, spins up child container.
- Child appears in tree in real-time (WebSocket push to frontend).
- Parent can read child events via `list_children` / `read_child_messages` (forwarded through DO).
- Gate: Agent emits spawn event → child node appears in tree → child starts working.

**2.6 -- Model list API**
- GET `/api/models` -- pulls from OpenRouter `/api/v1/models`, caches with 1hr TTL.
- Returns models grouped by provider with pricing info.
- Gate: Endpoint returns model list. SpawnModal dropdown populates from it.

### Phase 3: Session Management

**3.1 -- Dashboard (simplified)**
- List sessions: name, status, node count, last activity.
- "New session" button → session creation flow.
- Stop / delete actions per session.
- Gate: Dashboard lists sessions. Create → appears. Delete → removed. Status reflects reality.

**3.2 -- Session creation flow**
- "New session" → modal (name + git repo URL) → redirect to `/session/[id]` → spawn modal auto-opens.
- One flow, minimal friction.
- Gate: Click new → name session → land in session view → spawn first agent → send message → agent works.

### Phase 4: Long-loop features (docs.coey.dev parity)

**4.1 -- Status streaming (pings)**
- Agents emit `StatusEvent` periodically (context %, activity).
- Tree status dots update in real-time.
- Completion counts propagate up.
- Gate: Running agent emits status events → tree dot pulses → parent completion count updates.

**4.2 -- Context-limit handoff**
- Agent emits `HandoffEvent` when approaching context limit.
- DO extracts handoff summary, creates next session for the agent.
- Injects handoff context into new session.
- Visible in chat as handoff message block.
- Gate: Agent hits context limit → handoff event → new session starts → picks up where left off.

**4.3 -- Health checks (gates)**
- Before each agent session: type check, uncommitted work rescue, build verification.
- Results injected into agent's prompt via stdin `system` message.
- Auto-commit orphaned work.
- Gate: Agent starts → health check runs → results appear in agent context → orphaned work committed.

**4.4 -- Cross-session memory (Deja equivalent)**
- Agents can store/query persistent learnings.
- Memory surfaced in chat when injected at session start.
- Gate: Agent stores learning → next session queries → learning appears in context.

**4.5 -- Mobile responsive**
- Tree collapses to slide-out drawer on narrow viewports.
- Chat fills viewport.
- Real-time sync across devices (same WebSocket connection model).
- Gate: Narrow viewport → tree hidden → hamburger menu → slide out → select agent → chat visible.

### Phase 5: Shelley + Pi (native agents)

**5.1 -- Shelley agent image**
- Node.js process that calls OpenRouter with tool-use.
- Tools: read_file, write_file, edit_file, bash, git operations.
- Emits FAP events natively to stdout.
- System prompt: experienced full-stack engineer.
- Gate: Shelley container starts → receives task → calls LLM → uses tools → emits events → commits code.

**5.2 -- Pi agent image**
- Same runtime as Shelley, different persona.
- System prompt: research and analysis specialist.
- Tools biased toward reading, searching, summarizing.
- Gate: Pi container starts → receives research task → searches codebase → emits findings as text events.

**5.3 -- Claude Code adapter**
- Wrapper script that starts `claude` CLI.
- Parses claude's native output → FAP events.
- Forwards stdin messages to claude.
- Gate: Claude-code container starts → claude CLI runs → output parsed → FAP events stream.

**5.4 -- Remaining adapters (codex, cursor, amp)**
- Same adapter pattern for each CLI tool.
- Gate per adapter: container starts → CLI runs → FAP events stream.

---

## What gets deleted

When execution begins, these existing files/directories are replaced or removed:

| Path | Action | Reason |
|------|--------|--------|
| `migrations/` | Delete | Fresh schema from zero |
| `src/lib/components/session/SessionSidebar.svelte` | Replace | New: AgentTree.svelte |
| `src/lib/components/session/WorkerTabs.svelte` | Delete | No more worker tabs. Chat is the only view. |
| `src/lib/components/session/ChatPanel.svelte` | Replace | New: ChatView.svelte + ChatInput.svelte |
| `src/lib/components/wizard/` | Delete | No more wizard. Spawn modal replaces it. |
| `src/routes/session/new/` | Replace | Simplified session creation |
| `src/routes/session/[id]/+page.svelte` | Replace | New 2-panel layout |
| `src/routes/terminal/` | Delete | No terminal view |
| `src/lib/types/conductor.ts` | Replace | Protocol types replace conductor interface |
| `worker/index.ts` terminal handlers | Remove | No terminal rendering |

---

## Documentation (diataxis)

### Tutorial
"Build your first filepath agent" -- walk through creating a BYO agent that speaks FAP. Start with a bash script that echoes events, graduate to a real agent.

### How-to
- "Add a new agent type"
- "Configure model routing"
- "Handle context limits and handoffs"
- "Deploy filepath on your own Cloudflare account"

### Reference
- Protocol spec (the Zod schemas above)
- API endpoints
- Environment variables
- Agent catalog
- Schema reference

### Explanation
- Why tree-based orchestration
- Why chat-only (no terminal)
- Why CLI agents over hosted APIs
- The relay architecture (DO as conductor)
- Billing model

---

## Rules for execution agents

1. **`bun`/`bunx`** not npm/npx
2. **Alchemy** not wrangler -- `bun run deploy`, config in `alchemy.run.ts`
3. **Svelte 5** -- `onclick={fn}` not `on:click={fn}`, runes (`$state`, `$derived`, `$effect`)
4. **Push with `--no-verify`** -- pre-push hook runs svelte-check (slow)
5. **No explicit `any`** -- use `unknown`, generics, or specific types
6. **Gates before implementation** -- write the gate, then write the code
7. **Simplicity always** -- fewer clicks, fewer fields, fewer concepts
8. **Every agent is the same primitive** -- no special-casing orchestrator vs worker in UI
9. **Zod schemas are the source of truth** -- protocol types, not ad-hoc interfaces
10. **Commit after meaningful changes** -- descriptive messages, not batched dumps
