# filepath MCP (Model Context Protocol) Server

## What is MCP?

Model Context Protocol (MCP) is a standard protocol that allows AI agents to discover and invoke tools exposed by servers. Think of it as a universal API for AI tools.

## filepath's MCP Implementation

filepath exposes an MCP server that allows AI agents (like Claude Desktop, Cursor, etc.) to:

1. **List your sessions** - See all active agent sessions
2. **Create new sessions** - Start new projects programmatically
3. **Spawn agents** - Create agents from within AI conversations
4. **Send messages** - Chat with agents
5. **Check status** - See what agents are doing

## Why This Matters

**Without MCP:**
```
You: "Spawn a Pi agent to research this API"
AI: "I can't do that directly. You need to:
1. Go to myfilepath.com
2. Click 'New Session'
3. Name it
4. Click 'Spawn Agent'
5. Select 'Pi'
6. Enter the research task"
```

**With MCP:**
```
You: "Spawn a Pi agent to research this API"
AI: [Uses MCP tool to spawn agent directly]
AI: "Done! I've spawned a Pi researcher. Here's what it found..."
```

## SDK vs MCP

| | SDK | MCP |
|---|---|---|
| **For** | Your code/TypeScript projects | AI agents/LLMs |
| **Interface** | TypeScript functions | Natural language |
| **Who calls** | Your applications | AI models |
| **Discovery** | npm install, import | Tool descriptions |

## Implementation

filepath's MCP server is auto-generated from your OpenAPI spec and exposes:

### Tools

- `sessions_list` - List all your sessions
- `session_create` - Create a new session  
- `session_get` - Get session details with tree
- `session_delete` - Delete a session
- `nodes_list` - List agents in a session
- `node_spawn` - Spawn a new agent
- `node_send_message` - Send a message to an agent
- `node_get_status` - Check agent status
- `models_list` - List available AI models

### Resources

- `session://{id}` - Session metadata and tree structure
- `node://{id}` - Agent conversation history
- `user://keys` - Your API keys (masked)

## How to Use

### 1. Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "filepath": {
      "command": "npx",
      "args": ["-y", "@filepath/mcp-server"],
      "env": {
        "FILEPATH_BASE_URL": "https://myfilepath.com",
        "FILEPATH_SESSION_COOKIE": "your-session-cookie-here"
      }
    }
  }
}
```

### 2. Cursor

Add to Cursor settings:

```json
{
  "mcpServers": {
    "filepath": {
      "url": "https://myfilepath.com/api/mcp/sse"
    }
  }
}
```

### 3. API Key Auth

For programmatic access:

```bash
export FILEPATH_API_KEY="your-api-key"
export FILEPATH_BASE_URL="https://myfilepath.com"
```

## What This Enables

**Scenario 1: AI Spawns Helper Agents**
```
You: "Build me a React app with auth"
Claude: [Uses MCP to spawn Shelley agent]
Claude: [Uses MCP to spawn Pi researcher for auth patterns]
Claude: "I've spawned two agents working in parallel. Shelley is building the React scaffold, and Pi is researching best auth patterns..."
```

**Scenario 2: AI Checks on Long-Running Tasks**
```
You: "How's that code review going?"
Claude: [Uses MCP to check agent status]
Claude: "The Amp agent has reviewed 47 files and found 12 potential issues. Want me to show you the highlights?"
```

**Scenario 3: AI Manages Project State**
```
You: "Clean up my old sessions from last month"
Claude: [Uses MCP to list sessions]
Claude: [Uses MCP to delete 5 completed sessions]
Claude: "Done! Deleted 5 completed sessions. You now have 12 active sessions."
```

## Implementation Status

- [ ] MCP server endpoint (`/api/mcp`)
- [ ] OAuth flow for MCP auth
- [ ] Tool definitions (auto-generated from OpenAPI)
- [ ] SSE transport for streaming
- [ ] Resources (session trees, chat history)
- [ ] npm package `@filepath/mcp-server`
- [ ] Claude Desktop integration
- [ ] Cursor integration

## vs Better Auth's MCP Plugin

Better Auth's built-in MCP plugin (already configured) handles:
- **Authentication** - OAuth flow for MCP clients
- **Authorization** - Scope-based access control

filepath's MCP implementation (what we need to build) handles:
- **Business logic** - Spawning agents, managing sessions
- **Tools** - filepath-specific operations
- **Resources** - Session data, chat history

Both work together: Better Auth MCP secures the connection, filepath MCP provides the tools.
