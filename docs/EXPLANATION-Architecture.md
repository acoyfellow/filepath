# filepath Architecture Deep Dive

Understanding how the pieces fit together.

## Overview

filepath is built on a simple principle: **persistent, stateful agents that survive interruptions.**

Every agent runs in an isolated container with:
- Its own filesystem (`/workspace`)
- Its own process space
- Its own stdin/stdout streams
- Its own conversation history

The "magic" is that this state persists even when:
- You close your browser
- Your laptop dies
- The agent crashes and recovers
- You switch from desktop to phone

## Core Components

### 1. ChatAgent Durable Object (The Brain)

**Location:** `src/agent/chat-agent.ts`

Every agent node has its own **Durable Object** - a long-lived process on Cloudflare's edge.

```
┌─────────────────────────────────────┐
│  ChatAgent DO (one per agent node)  │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  State:                     │   │
│  │  - nodeId                   │   │
│  │  - sessionId                │   │
│  │  - model                    │   │
│  │  - conversation history     │   │
│  │  - container reference      │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  WebSocket connections:     │   │
│  │  - Client A (desktop)       │   │
│  │  - Client B (phone)           │   │
│  │  - Broadcasting to all      │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  Container handle:        │   │
│  │  - Sandbox reference        │   │
│  │  - stdin Writer             │   │
│  │  - stdout Reader (NDJSON)   │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Key insight:** The DO persists even if all clients disconnect. When you reconnect, the DO is already there with all state intact.

### 2. Cloudflare Sandbox (The Body)

**Technology:** Firecracker microVMs (same as AWS Lambda)

Each agent gets an isolated Linux container:

```
┌─────────────────────────────────────┐
│  Firecracker MicroVM                │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  /workspace                 │   │
│  │  - Git repo (if provided)   │   │
│  │  - All file operations      │   │
│  │  - Persists across runs     │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  Agent Process              │   │
│  │  - Reads FILEPATH_* env     │   │
│  │  - Reads stdin (NDJSON)     │   │
│  │  - Writes stdout (NDJSON)   │   │
│  └─────────────────────────────┘   │
│                                     │
│  Network: Limited egress only      │
│  RAM: 2GB limit                     │
│  Sleep: After 5min idle             │
└─────────────────────────────────────┘
```

**Key insight:** Containers sleep after idle, but filesystem persists. When a message arrives, the container wakes up.

### 3. D1 Database (The Memory)

**Technology:** SQLite on Cloudflare's edge

Stores:

```
user
├── id, email, password
├── openrouterApiKey (encrypted)  ← Account-level API key
└── ...

agent_session
├── id, userId, name
├── apiKey (encrypted, nullable)   ← Per-session override
├── status (draft|running|stopped)
└── ...

agent_node (tree structure)
├── id, sessionId
├── parentId (self-referential FK)
├── name, agentType, model
├── config (JSON: envVars, etc.)
└── ...
```

**Key insight:** The tree structure lets agents spawn child agents. `parentId` creates the hierarchy.

### 4. WebSocket Layer (The Nervous System)

**Protocol:** Real-time bidirectional

```
Client (Browser)              ChatAgent DO
     │                              │
     │  WS: CONNECT                 │
     │ ─────────────────────────>   │
     │                              │
     │  WS: History + State         │
     │ <─────────────────────────   │
     │                              │
     │  WS: {type:"message"...}     │
     │ ─────────────────────────>   │
     │                              │
     │  WS: {type:"text"...}        │
     │ <─────────────────────────   │
     │  WS: {type:"tool"...}        │
     │ <─────────────────────────   │
     │                              │
```

**Key insight:** Multiple clients can connect to the same DO. All see the same real-time updates.

### 5. SvelteKit Frontend (The Face)

**Architecture:**

```
┌─────────────────────────────────────┐
│  Browser                            │
│                                     │
│  ┌──────────────┐ ┌──────────────┐│
│  │  Tree View   │ │  Chat Panel  ││
│  │  (left)      │ │  (right)     ││
│  │              │ │              ││
│  │  Session 1   │ │  ┌────────┐  ││
│  │    ├─ Node A │ │  │ User   │  ││
│  │    │   ├─ B  │ │  │ Agent  │  ││
│  │    ├─ Node C │ │  │ Tool   │  ││
│  │              │ │  └────────┘  ││
│  │  Click any   │ │              ││
│  │  node →      │ │  Real-time   ││
│  │  load chat   │ │  event stream││
│  └──────────────┘ └──────────────┘│
│                                     │
│  WebSocket: Single connection       │
│  to ChatAgent DO per node          │
└─────────────────────────────────────┘
```

**Key insight:** Tree on left, chat on right. Click any node to see its conversation.

## Data Flow: A Complete Walkthrough

### Step 1: User Creates Session

```
Browser → POST /api/sessions
             ↓
         D1: INSERT agent_session
             ↓
         Response: {id, name}
```

### Step 2: User Spawns Agent

```
Browser → POST /api/sessions/[id]/nodes
             Body: {name, agentType, model, apiKey?}
             ↓
         D1: INSERT agent_node
             ↓
         ChatAgent DO created (lazy, on first WebSocket connect)
             ↓
         Response: {id, name}
```

### Step 3: User Sends Message

```
Browser → WS /agents/chat-agent/[nodeId]
             Message: {type:"message", content:"fix auth"}
             ↓
         ChatAgent DO receives message
             ↓
         DO checks: Session key? User key? Fallback?
             ↓
         DO spawns container (if not running)
             - Pull image
             - Set env vars
             - Start process
             ↓
         DO writes to container stdin:
             {"type":"message","from":"user","content":"fix auth"}
             ↓
         Container processes, emits to stdout:
             {"type":"status","state":"thinking"}
             {"type":"text","content":"I'll fix auth..."}
             {"type":"tool","name":"grep","status":"success"}
             ...
             {"type":"done"}
             ↓
         DO reads stdout, parses NDJSON
             ↓
         DO broadcasts to all connected WebSockets
             ↓
         All clients (desktop, phone) see updates in real-time
             ↓
         DO persists events to D1 (messages table)
```

### Step 4: User Closes Laptop

```
Browser → WS disconnects
             ↓
         ChatAgent DO: "Client A disconnected"
             ↓
         DO keeps running (other clients? container?)
         DO: "Last client, stop container in 5min"
             ↓
         Container sleeps after idle timeout
             ↓
         DO persists state
             ↓
         DO waits (very cheap, just storage)
```

### Step 5: User Opens Phone

```
Browser (phone) → WS /agents/chat-agent/[nodeId]
             ↓
         ChatAgent DO: "Client B connected"
             ↓
         DO loads history from memory/D1
             ↓
         DO sends to client:
             - Full conversation history
             - Current status
             ↓
         User sees exact same state as desktop
             ↓
         User sends message...
         (Back to Step 3 flow)
```

## Key Design Decisions

### Why Durable Objects?

**Problem:** HTTP is stateless. How do we keep state?

**Solution:** Durable Objects are the state. They're long-lived, persist across requests, and have in-memory storage.

**Alternative:** Redis/WebSockets with separate state. More complex, another service to manage.

### Why Firecracker/Sandbox?

**Problem:** Need isolated, secure execution for user code.

**Solution:** Firecracker microVMs provide:
- Fast startup (<100ms)
- Strong isolation
- Low overhead
- Auto-sleep for cost savings

**Alternative:** Docker in VMs. Slower, more expensive.

### Why NDJSON Protocol?

**Problem:** How does container talk to DO?

**Solutions considered:**
- gRPC: Too complex, requires protos
- WebSocket: Too many connections
- HTTP polling: Too slow

**NDJSON wins because:**
- Simple: one JSON line per event
- Streaming: real-time without complexity
- Debuggable: `cat log.ndjson | jq`
- Language-agnostic: any agent can speak it

### Why BYOK?

**Problem:** Who pays for LLM API costs?

**Options:**
1. We pay: Charge users markup (Stripe complexity)
2. Users pay: Bring their own keys (simple)

**BYOK wins because:**
- No billing infrastructure
- No credit cards to manage
- No usage metering/quota system
- Users control their spend directly
- We focus on infrastructure, not financial plumbing

## Failure Modes

### Container Crashes

**Detection:** Write to stdin fails, or stdout closes unexpectedly

**Recovery:**
1. DO catches error
2. Broadcasts "error" status
3. Optional: Retry spawn (configurable)
4. Fallback: Direct LLM call (bypass container)

### DO Crashes

**Detection:** DO restarts, loses in-memory state

**Recovery:**
1. DO restarts from D1 on next WebSocket connect
2. Loads: node config, conversation history
3. Restores state
4. User may see "reconnecting..." briefly

### Network Partitions

**Scenario:** User's internet drops for 5 minutes

**Behavior:**
1. WebSocket disconnects
2. DO keeps running (if other clients connected)
3. User reconnects
4. DO sends all events since disconnect
5. User sees full history, nothing lost

### D1 Outage

**Scenario:** D1 temporarily unavailable

**Behavior:**
1. Writes fail
2. DO continues in-memory only
3. DO retries writes periodically
4. If DO restarts during outage: state lost (rare)
5. Once D1 returns: normal operation

## Scaling Characteristics

### What Scales Automatically

- **Durable Objects:** Unlimited, created on demand
- **D1:** Automatic read replicas
- **WebSocket connections:** Per-DO limit (high)
- **Sandbox containers:** Per-account limits (soft)

### What Needs Attention

- **Container startup:** Cold start ~2s (warm start ~100ms)
- **Memory:** DOs have 128MB memory limit
- **CPU:** DOs have CPU time limits (fine for chat)

### Cost Model

**Cloudflare pricing:**
- Durable Objects: $0.12/million requests
- D1: $1/10M reads, $5/1M writes
- Sandbox: Free tier generous
- Workers: $5/10M requests

**Our costs:**
- Primarily Sandbox container runtime
- Negligible DO/D1 costs at our scale
- No LLM costs (BYOK)

## Security Model

### Tenant Isolation

```
User A's Session 1
├── ChatAgent DO (isolated)
├── Container (isolated VM)
└── D1 rows (user-scoped queries)

User B's Session 2
├── Separate ChatAgent DO
├── Separate Container
└── Separate D1 rows
```

**Guarantees:**
- Users cannot see other users' sessions
- Containers cannot escape their microVM
- API keys are encrypted at rest
- Network egress is limited

### API Key Handling

```
User provides key
    ↓
Encrypted with AES-GCM
    ↓
Stored in D1 (ciphertext only)
    ↓
Decrypted only when spawning container
    ↓
Passed to container via env var
    ↓
Container uses for LLM calls
```

**Key insight:** Keys are never logged, never sent to clients, never visible in UI.

## Future Architecture Evolution

### What's Coming

1. **Zen Router:** CF AI Gateway for multi-provider routing
2. **Session Sharing:** Share sessions with team members
3. **Agent Marketplace:** Discover and install community agents
4. **Git Integration:** Native git operations, PR creation
5. **Persistence Layer:** S3/R2 for large artifacts

### What's Stable

- Core protocol (FAP)
- DO/Container architecture
- D1 schema
- WebSocket protocol

## Summary

filepath's architecture is designed for:

- ✅ **Persistence:** State survives everything
- ✅ **Isolation:** Each agent is truly separate
- ✅ **Real-time:** WebSocket broadcast to all clients
- ✅ **Scalability:** Cloudflare's edge handles it
- ✅ **Simplicity:** BYOK removes billing complexity
- ✅ **Extensibility:** FAP protocol lets anyone build agents

The magic isn't any single technology. It's how they compose: DOs for state, Firecracker for isolation, NDJSON for communication, D1 for memory.
