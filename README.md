# filepath

> A personal Cloudflare-hosted development environment. Work lives in conversations, not terminal tabs.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/acoyfellow/filepath)

[OpenAPI](./src/routes/api/openapi.json/+server.ts)

## Quickstart

### Deploy

filepath deploys via [Alchemy](https://github.com/alchemy-web/alchemy). The entrypoint is `alchemy.run.ts`.

```bash
git clone https://github.com/acoyfellow/filepath
cd filepath
bun install
```

Set environment variables in `.env`:

```
ALCHEMY_PASSWORD=<random string for encrypting Alchemy state>
BETTER_AUTH_SECRET=<random 32+ character string>
BETTER_AUTH_URL=https://your-domain.com
CLOUDFLARE_API_TOKEN=<your Cloudflare API token>
CLOUDFLARE_ACCOUNT_ID=<your Cloudflare account ID>
```

Deploy:

```bash
bun run deploy
```

### Local development

```bash
bun install
bun run dev
```

Then open `http://localhost:5173/signup`.

### Development

```bash
bun run lint    # ESLint (source + Svelte)
bun run check   # svelte-check + TypeScript
bun test        # Bun test runner
```

### First conversation

1. Sign in and land on the dashboard (a global inbox).
2. Create a workspace (optionally with an initial source URL).
3. Add **model provider keys** in **Settings → Account** (e.g. OpenRouter, OpenCode Zen) if you want live model calls.
4. Open the workspace and create a conversation with a harness, model, file scope, and tool permissions.
5. Send a task.

Each conversation is always in one state: **Ready**, **Running**, **Blocked**, or **Closed**.

## How-to

### Restrict a conversation to specific paths

- `allowedPaths` — directories the conversation may touch
- `forbiddenPaths` — blocks inside that scope
- `writableRoot` — working directory for commands

```json
{
  "allowedPaths": ["apps/web", "packages/ui"],
  "forbiddenPaths": ["apps/web/.env", "packages/ui/dist"],
  "writableRoot": "apps/web"
}
```

### Allow only certain tools

`toolPermissions` is explicit: `inspect`, `search`, `run`, `write`, `commit`, `cross_thread`.

**`cross_thread`** (same workspace only): agents can call the runtime bridge to **list threads** (`count` + ids), **read last message / snapshot** for another thread, and **enqueue a task** on another thread. **JSON harnesses** (`shelley`, `pi`, …) do this inside the main edit loop. **Subprocess harnesses** (e.g. the optional **`hermes`** adapter) run a short **OpenRouter preflight** on the bridge, then execute their CLI with that context prepended. Requires a configured public runtime URL (`FILEPATH_RUNTIME_PUBLIC_BASE_URL` / `API_WS_HOST` on the worker).

If a conversation lacks `write` or `commit` permission, filepath rejects the action at runtime. Tool-permission escalation creates a real approval interruption.

### Switch harnesses or models

Change `harnessId` or `model` on a conversation. Same workspace, same scope, different runtime. **`harnessId` must match a row in the harness registry** (seeded defaults include `shelley`, `pi`, `claude-code`, `codex`, `cursor`, `amp`, `hermes`, …; admins can add more under **Settings → Harness registry** when enabled).

### Optional: `hermes` harness ([Hermes Agent](https://github.com/NousResearch/hermes-agent))

The **`hermes`** id is a normal harness entry that runs `node /opt/filepath/adapters/hermes/index.mjs`. The adapter installs [Hermes Agent](https://github.com/NousResearch/hermes-agent) into a sandbox venv on first use (pip), so image rebuilds are not required for version bumps.

- **Version pinning** — In **Settings → Harness registry**, select the **`hermes`** harness and set `hermesVersion` in the JSON config (`main` for latest, or a git ref such as `v0.1.0`).
- **Scope + tool gates** — Same as other harnesses: FAP events are derived from git diffs; paths must respect `allowedPaths` / `forbiddenPaths`; `commit` needs the `commit` tool permission.
- **Sandbox image** — Needs `python3`, `python3-venv`, and `python3-pip` for the pip install path.

## Reference

### What filepath is

- A personal Better Auth-protected dashboard
- A global inbox of conversations across workspaces
- Bounded execution against sandboxed workspaces
- Explicit human control: close, reopen, pause, resume, approve, reject

### What filepath is not

- A proof engine (see [Gateproof](https://github.com/acoyfellow/gateproof))
- A multi-user platform
- Dependent on experimental Cloudflare features

### Concepts

- **workspace** — a sandboxed filesystem environment
- **conversation** — a thread of bounded work inside a workspace
- **scope** — allowed paths, forbidden paths, tool permissions, writable root
- **result** — structured output from an agent run
- **inbox** — the derived view of open, running, blocked, and closed conversations

### Structured result shape

Every run returns: `status`, `summary`, `commands`, `filesTouched`, `violations`, `diffSummary`, `patch`, `commit`, `startedAt`, `finishedAt`.

### Programmatic run API

`POST /api/workspaces/:id/run` — runs one bounded task, returns a structured result. Useful for proof engines and external tools.

```json
{
  "content": "Task description",
  "harnessId": "shelley",
  "model": "anthropic/claude-sonnet-4",
  "scope": {
    "allowedPaths": ["."],
    "forbiddenPaths": [".git", "node_modules"],
    "toolPermissions": ["search", "run", "write", "commit"],
    "writableRoot": "."
  },
  "agentId": "optional — omit for new conversation, include to continue",
  "identity": {
    "traceId": "optional",
    "proofRunId": "optional",
    "proofIterationId": "optional"
  }
}
```

Response (200): `status`, `summary`, `events`, `filesTouched`, `violations`, `diffSummary`, `patch`, `commit`, `agentId`, `runId`, `traceId`, `workspaceId`, `conversationId`, `proofRunId`, `proofIterationId`, `startedAt`, `finishedAt`.

Auth: session or API key (`Authorization: Bearer <key>` or `X-Api-Key: <key>`).

### API surface

```
GET    /api/workspaces
POST   /api/workspaces
GET    /api/workspaces/:id
PATCH  /api/workspaces/:id
DELETE /api/workspaces/:id
GET    /api/workspaces/:id/agents
POST   /api/workspaces/:id/agents
GET    /api/workspaces/:id/agents/:agentId
PATCH  /api/workspaces/:id/agents/:agentId
DELETE /api/workspaces/:id/agents/:agentId
POST   /api/workspaces/:id/agents/:agentId/tasks
POST   /api/workspaces/:id/agents/:agentId/cancel
POST   /api/workspaces/:id/agents/:agentId/close
POST   /api/workspaces/:id/agents/:agentId/reopen
POST   /api/workspaces/:id/agents/:agentId/pause
POST   /api/workspaces/:id/agents/:agentId/resume
POST   /api/workspaces/:id/agents/:agentId/approve
POST   /api/workspaces/:id/agents/:agentId/reject
POST   /api/workspaces/:id/run
POST   /api/workspaces/:id/run/script
GET    /api/openapi.json
```

### Authentication

Better Auth is the auth boundary.

- Sign up and sign in through the app
- Dashboard and API use the same session
- Programmatic access: create an API key in Settings
- Production must use a random 32+ character `BETTER_AUTH_SECRET`

### Runtime contract

**Scope layer** — `src/lib/runtime/authority.ts` is the deterministic core. Path normalization, scope checks, and policy violations are pure functions. No LLM.

**Task lifecycle** — States: `queued`, `starting`, `running`, `retrying`, `succeeded`, `failed`, `canceled`, `stalled`. Invalid transitions are rejected. Terminal states are final.

**Events** — Harness events are schema-validated. Invalid JSON fails the run with a protocol error. Process crash transitions to `failed` or `stalled`; never left in `running`.

**Script-only runs** — `POST /api/workspaces/:id/run/script` runs a fixed command with scope enforcement, no LLM.

## Explanation

### Why filepath exists

Models and harnesses change fast. The durable value is the runtime boundary: a sandboxed workspace, scoped agents, and structured results.

### Why Alchemy

`alchemy.run.ts` is the single deployment entrypoint. It provisions D1, the sandbox container, the Worker, and Durable Objects (see that file for the live list).

## Engineer section

### Commands

```bash
bun install
bun run dev          # local development
bun run check        # typecheck
bun run test         # tests
bun run build        # production build
bun run deploy       # deploy to production
```

### CI/CD

Push to `main` triggers: typecheck, build, gate checks, then production deploy via Alchemy. Other branches get preview deploys.

### Reviewer map (~7 min)

Read in order (no extra layers to learn):

1. `alchemy.run.ts` — what ships to Cloudflare
2. `src/core/app.ts` — workspace/agent CRUD backing the API
3. `src/lib/schema.ts` — D1 shape
4. `src/lib/runtime/authority.ts` — scope + tool policy (pure)
5. `src/lib/runtime/agent-runtime.ts` — task lifecycle, sandbox run, D1 updates, interruptions (one big file on purpose; list exports: `rg '^export ' src/lib/runtime/agent-runtime.ts`)
6. `src/routes/api/workspaces/` — HTTP surface
7. `worker/agent.ts`, `worker/conversation-agent.ts` — queue/durable entry → runtime

UI: `src/routes/+layout.svelte` then dashboard inbox vs `workspace/[id]`.

Principle: flat modules, direct imports. Split a file only when a block is obviously separable *and* navigation pain is real.
