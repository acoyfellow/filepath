# filepath

> filepath is a personal Cloudflare-hosted development environment for spawning bounded background agents against a sandboxed git clone.

[Deploy to Cloudflare](https://github.com/acoyfellow/filepath) · [OpenAPI](./src/routes/api/openapi.json/+server.ts)

## Tutorial

### 60-second quickstart

1. Deploy filepath into your Cloudflare account.
2. Set `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`.
3. Open the app, sign in, and land on `/dashboard`.
4. Create a workspace with an optional git repo URL.
5. Create an agent with a harness, model, file scope, and tool permissions.
6. Submit a task and inspect the live result stream.

Local development:

```bash
bun install
bun run dev
bun run smoke:local
```

Then open:

- `http://localhost:5173/signup`
- `http://localhost:5173/dashboard`

### First agent

1. Create a workspace.
2. Add an account router key in Settings.
3. Open the workspace.
4. Create an agent with:
   - `harness`
   - `model`
   - `allowedPaths`
   - `forbiddenPaths`
   - `toolPermissions`
   - `writableRoot`
5. Send the first task from the agent panel.

## How-to

### Restrict an agent to one part of a repo

Use:

- `allowedPaths` for directories the agent may touch
- `forbiddenPaths` for extra blocks inside that scope
- `writableRoot` for the working directory commands should run from

Example:

```json
{
  "allowedPaths": ["apps/web", "packages/ui"],
  "forbiddenPaths": ["apps/web/.env", "packages/ui/dist"],
  "writableRoot": "apps/web"
}
```

### Allow only certain tools

`toolPermissions` is explicit.

Available values:

- `inspect`
- `search`
- `run`
- `write`
- `commit`

If an agent is not allowed to write or commit, filepath should reject that action at runtime instead of relying on prompt wording.

### Switch harnesses or models

Harness and model are runtime configuration, not architecture.

- change `harnessId` to switch the agent harness
- change `model` to switch the backing model
- keep the same workspace, agent scope, and dashboard surface

## Reference

### What filepath is

filepath v1 is:

- a personal Better Auth-protected dashboard
- backed by one Cloudflare worker gateway
- built on stable published Cloudflare npm APIs
- centered on flat background agents running against a sandboxed git clone

filepath v1 is not:

- a proof engine
- a multi-user platform
- dependent on experimental Cloudflare features

### Public concepts

- `workspace`: a repo-backed sandbox environment
- `agent`: a bounded background agent inside a workspace
- `scope`: allowed paths, forbidden paths, tool permissions, writable root
- `result`: structured output from an agent run

### Agent scope fields

- `allowedPaths`
- `forbiddenPaths`
- `toolPermissions`
- `writableRoot`
- `harnessId`
- `model`

### Structured result shape

At minimum:

- `status`
- `summary`
- `commands`
- `filesTouched`
- `violations`
- `diffSummary`
- `commit`
- `startedAt`
- `finishedAt`

### Programmatic run API

`POST /api/workspaces/:id/run` runs one bounded task and returns a structured result (sync). Useful for external tools (e.g. proof engines) that need a direct execution surface.

**Input:**

```json
{
  "content": "Task description",
  "harnessId": "filepath",
  "model": "anthropic/claude-3.5-sonnet",
  "scope": {
    "allowedPaths": ["."],
    "forbiddenPaths": [".git", "node_modules"],
    "toolPermissions": ["search", "run", "write", "commit"],
    "writableRoot": "."
  },
  "agentId": "optional – omit for new run, include to continue a thread"
}
```

**Response (200):** machine-stable contract

- `status`, `summary`, `events`, `filesTouched`, `violations`, `diffSummary`, `commit`
- `agentId`, `runId`, `startedAt`, `finishedAt`

**Auth:** session or API key (`Authorization: Bearer <key>`). User must own the workspace.

### API surface

Core routes:

- `GET /api/workspaces`
- `POST /api/workspaces`
- `GET /api/workspaces/:id`
- `PATCH /api/workspaces/:id`
- `DELETE /api/workspaces/:id`
- `GET /api/workspaces/:id/agents`
- `POST /api/workspaces/:id/agents`
- `GET /api/workspaces/:id/agents/:agentId`
- `PATCH /api/workspaces/:id/agents/:agentId`
- `DELETE /api/workspaces/:id/agents/:agentId`
- `POST /api/workspaces/:id/agents/:agentId/tasks`
- `POST /api/workspaces/:id/agents/:agentId/cancel`
- `POST /api/workspaces/:id/run` – programmatic run (new or continue thread; returns structured result + events)

Machine-readable reference:

- `/api/openapi.json`

### Authentication

Better Auth is the only supported auth boundary in v1.

- sign up and sign in through the app
- dashboard and API both use the Better Auth session
- programmatic access: create an API key in Settings; use `Authorization: Bearer <key>` or `X-Api-Key: <key>`
- no public unauthenticated product surface
- local dev may use the placeholder secret from `.env.example`
- production must use a random 32+ character `BETTER_AUTH_SECRET`

### Current stable runtime contract

- the dashboard shows a flat agent list inside a workspace
- humans create agents directly
- agents do not spawn child agents in v1
- task input is agent work input, not a general product chat protocol

## Explanation

### Why filepath exists

Models change fast. Harnesses change fast. The durable value is the runtime boundary around software work:

- clone a repo into a bounded workspace
- start background agents against that workspace
- scope them to files and tools
- return structured results to the human

### Why Better Auth

filepath is a personal product, but it still needs a real sign-in flow.

Better Auth keeps the app honest:

- one auth story
- same auth for dashboard and API
- no custom header shortcuts in the product contract

### Why flat agents in v1

filepath v1 keeps the shipped model small and honest:

- human-created agents
- explicit file and tool scope
- persistent results
- no hidden hierarchy or orchestration layer

### Why stable Cloudflare surfaces only

filepath should be a real deployable product, not a lab branch.

That means:

- no GitHub-source dependency pins
- no `experimental` compatibility flag
- no dependency on unreleased child-agent APIs

## Checklist

### North star

- personal Better Auth-protected Cloudflare development environment
- dashboard-first, API underneath
- sandboxed git clone as the live workspace
- swappable models
- swappable harnesses
- bounded agents with explicit file and tool permissions

### Stable assumptions

- Better Auth only
- one worker gateway
- flat agents in v1
- stable published Cloudflare surfaces only
- README is the only canonical product document

### Next build phases

1. finish the flat workspace/agent dashboard
2. make agent results more durable and inspectable
3. tighten runtime enforcement around file and tool scope
4. simplify the public API around workspace and agent lifecycle
5. improve local runtime fidelity and result richness

### Delete aggressively

- stale pre-v1 product language
- stale proof-engine language
- stale gates and scripts that validate deleted routes
- compatibility shims that keep old mental models alive

### Out of bounds

- child-agent runtime before stable support ships
- proof policy inside filepath
- one-model or one-harness lock-in
- preserving old data or old route shapes

## Engineer section

### Commands

```bash
bun install
bun run dev
bun run check
bun run build
bun run smoke:local
```

### CI/CD

On push (any branch): `test` runs `bun run check`, `bun run build`, and `gates/protocol.gate.sh`. On success, `deploy` runs: production (`bun run deploy`) on `main`, or preview (destroy + deploy by branch) on other branches. Legacy proof engine and production e2e gates have been removed; remaining gates (`gates/protocol.gate.sh`, `gates/no-fallback-runtime.gate.sh`, `gates/health.sh`) are for manual use.

### Key files

- `src/core/app.ts`
- `src/lib/schema.ts`
- `src/lib/runtime/authority.ts`
- `src/lib/runtime/agent-runtime.ts`
- `src/routes/dashboard/+page.svelte`
- `src/routes/workspace/[id]/+page.svelte`
- `src/lib/components/workspace/CreateAgentModal.svelte`
- `src/routes/api/workspaces/`

### Repo rules

- destructive reset is allowed
- preserve only the current v1 workspace/agent story
- keep auth, API, UI, and runtime aligned to the same product vocabulary
- if a file still tells the old product story, rewrite it or delete it

### Future

filepath may grow into richer orchestration later, but v1 should stay focused on workspaces, flat agents, and bounded task execution.
