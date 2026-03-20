# filepath

> A personal Cloudflare-hosted development environment. Work lives in conversations, not terminal tabs.

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

### First conversation

1. Sign in and land on the dashboard (a global inbox).
2. Create a workspace (optionally with an initial source URL).
3. Add a provider router key in Settings.
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

`toolPermissions` is explicit: `inspect`, `search`, `run`, `write`, `commit`.

If a conversation lacks `write` or `commit` permission, filepath rejects the action at runtime. Tool-permission escalation creates a real approval interruption.

### Switch harnesses or models

Change `harnessId` or `model` on a conversation. Same workspace, same scope, different runtime.

### Custom harness (Hermes)

The `custom` harness runs [Hermes Agent](https://github.com/NousResearch/hermes-agent) inside the sandbox. filepath bootstraps Hermes at runtime (download + cache), so you don't need to rebuild the sandbox image for Hermes updates.

- **Version pinning** — Set `hermesVersion` in the harness config (Admin → Harness registry → Edit custom). Use `main` for latest, or a git ref (e.g. `v0.1.0`) for a pinned release.
- **Scope + tool gates** — filepath derives FAP events from git diffs after Hermes runs. Only changes inside `allowedPaths` and outside `forbiddenPaths` are allowed. `commit` events require the `commit` tool permission.
- **Runtime bootstrap** — Hermes is installed via pip into a sandbox cache on first use. The sandbox image needs `python3`, `python3-venv`, and `python3-pip`.

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
  "harnessId": "filepath",
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

`alchemy.run.ts` is the single deployment entrypoint. It provisions all Cloudflare resources (D1, Workers, Containers, Vectorize) declaratively. Adding Deja is a few lines in the same file.

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

### Key files

- `alchemy.run.ts` — deployment entrypoint (all Cloudflare resources)
- `src/core/app.ts` — workspace/agent CRUD
- `src/lib/schema.ts` — D1 database schema
- `src/lib/runtime/authority.ts` — scope enforcement (deterministic)
- `src/lib/runtime/agent-runtime.ts` — task execution
- `src/routes/dashboard/+page.svelte` — inbox UI
- `src/routes/workspace/[id]/+page.svelte` — workspace UI
- `src/routes/api/workspaces/` — API routes
