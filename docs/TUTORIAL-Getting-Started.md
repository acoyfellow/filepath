# Getting Started with filepath

A hands-on tutorial to run your first agent.

## What you'll learn

- How to create a session
- How to add your API key
- How to spawn an agent
- How to interact via chat

## Prerequisites

- An account at https://myfilepath.com
- An API key from a supported provider:
  - [OpenRouter](https://openrouter.ai/keys) (recommended - access to multiple models)
  - [OpenAI](https://platform.openai.com/api-keys)
  - [Anthropic](https://console.anthropic.com/)

## Step 1: Add Your API Key

filepath uses a BYOK (bring your own key) model. You provide the API keys; we provide the infrastructure.

1. Sign in to filepath
2. Go to **Settings** → **Provider API Keys**
3. Paste your OpenRouter (or other provider) API key
4. Click **Save**

Your key is encrypted and stored securely. filepath never shares or logs your keys.

## Step 2: Create a Session

A session is a persistent workspace for your agents.

1. From the dashboard, click **New Session**
2. Give it a name (e.g., "My First Agent")
3. (Optional) Add a git repo URL to clone into `/workspace`
4. Click **Create**

The session is now created and ready for agents.

## Step 3: Spawn an Agent

1. In your session, click **Spawn Agent**
2. Choose an agent type:
   - **claude-code**: Full-featured coding agent (requires Anthropic/OpenRouter key)
   - **codex**: OpenAI's coding agent
   - **cursor**: Cursor's agent mode
   - **custom**: Bring your own container
3. Select a model (e.g., `anthropic/claude-sonnet-4.5`)
4. (Optional) Set a specific API key for this session only
5. Click **Spawn**

The agent starts in an isolated container with your repo at `/workspace`.

## Step 4: Send a Task

1. Click on the agent node in the tree (left sidebar)
2. The chat panel opens (right side)
3. Type your task: *"Find all TODO comments in the codebase and list them"*
4. Press Enter

The agent:
- Receives your message on stdin as NDJSON
- Starts working in the container
- Emits events to stdout (file reads, tool calls, etc.)
- Shows progress in real-time in the chat panel

## What you'll see

As the agent works, you'll see:

- **Text events**: The agent's responses
- **Tool events**: Commands it's running (git, grep, etc.)
- **Command events**: Shell commands
- **Status updates**: `thinking` → `running` → `idle`

All events are timestamped and persisted. Close your laptop, open your phone - same state.

## Step 5: Child Agents (Optional)

Agents can spawn child agents:

1. The agent emits: `{"type":"spawn","agent":"worker-1","task":"Refactor auth"}`
2. A new node appears in the tree
3. Click it to see its isolated conversation
4. The parent continues while children work

## Next Steps

- Read the [Protocol Spec](../NORTHSTAR.md) to understand FAP
- See [Agent Catalog](../AGENTS.md) for built-in agents
- Build a [Custom Agent](../AGENTS.md#custom-agents) with your Dockerfile

## Troubleshooting

**"No API key configured" error**
→ Add your key in Settings → Provider API Keys

**Agent not responding**
→ Check that your API key has credits/balance with the provider

**Session not loading on mobile**
→ Sessions sync automatically. Try refreshing.
