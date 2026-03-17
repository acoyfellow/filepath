# filepath 0.05

> filepath is a personal Cloudflare-hosted development environment. Work lives in conversations, not terminal tabs.

[Deploy to Cloudflare](https://github.com/acoyfellow/filepath) · [OpenAPI](./src/routes/api/openapi.json/+server.ts)

## Tutorial

### 60-second quickstart

1. Deploy filepath into your Cloudflare account.
2. Set `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`.
3. Open the app, sign in, and land on `/dashboard`.
4. Create a workspace with an optional git repo URL.
5. Start a conversation with a harness, model, file scope, and tool permissions.
6. Submit a bounded task and inspect the live result stream.

Local development:

```bash
bun install
bun run dev
bun run smoke:local
```

Then open:

- `http://localhost:5173/signup`
- `http://localhost:5173/dashboard`

### First conversation

1. Create a workspace.
2. Add an account router key in Settings.
3. Open the workspace.
4. Create a conversation with:
   - `harness`
   - `model`
   - `allowedPaths`
   - `forbiddenPaths`
   - `toolPermissions`
   - `writableRoot`
5. Send the first task from the conversation panel.

filepath 0.05 opens to a global inbox. Each conversation is always in one clear state:

- `Ready`
- `Running`
- `Blocked`
- `Closed`

## How-to

### Restrict a conversation to one part of a repo

Use:

- `allowedPaths` for directories the conversation may touch
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

If a conversation is not allowed to write or commit, filepath rejects that action at runtime instead of relying on prompt wording. In 0.05, tool-permission escalation creates a real approval interruption instead of silently continuing.

### Switch harnesses or models

Harness and model are runtime configuration, not architecture.

- change `harnessId` to switch the agent harness
- change `model` to switch the backing model
- keep the same workspace, agent scope, and dashboard surface

## Reference

### What filepath is

filepath 0.05 is:

- a personal Better Auth-protected dashboard
- a global inbox of conversations across workspaces
- bounded execution against sandboxed repo clones
- explicit human control: close, reopen, pause, resume, approve, reject
- optionally memory-aware when a workspace enables Deja-backed recall

filepath 0.05 is not:

- a proof engine
- a multi-user platform
- dependent on experimental Cloudflare features

### Public concepts

- `workspace`: a repo-backed sandbox environment
- `conversation`: the user-facing thread of bounded work inside a workspace
- `scope`: allowed paths, forbidden paths, tool permissions, writable root
- `result`: structured output from an agent run
- `inbox`: the derived view of open, running, blocked, and closed conversations

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
- `patch`
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
  "agentId": "optional – omit for a new conversation, include to continue one",
  "identity": {
    "traceId": "optional",
    "proofRunId": "optional",
    "proofIterationId": "optional"
  }
}
```

**Response (200):** machine-stable contract

- `status`, `summary`, `events`, `filesTouched`, `violations`, `diffSummary`, `patch`, `commit`
- `agentId`, `runId`, `traceId`, `workspaceId`, `conversationId`, `proofRunId`, `proofIterationId`, `startedAt`, `finishedAt`

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
- `POST /api/workspaces/:id/agents/:agentId/close`
- `POST /api/workspaces/:id/agents/:agentId/reopen`
- `POST /api/workspaces/:id/agents/:agentId/pause`
- `POST /api/workspaces/:id/agents/:agentId/resume`
- `POST /api/workspaces/:id/agents/:agentId/approve`
- `POST /api/workspaces/:id/agents/:agentId/reject`
- `POST /api/workspaces/:id/run` – programmatic run (new or continue thread; returns structured result + events)
- `POST /api/workspaces/:id/run/script` – script-only run (deterministic; no LLM; scope enforcement)

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

- the dashboard opens to a global inbox of conversations
- each workspace shows the same conversations filtered to that workspace
- task input is conversation work input, not a general product chat protocol
- closed conversations reject new turns
- blocked conversations require a real human decision before they continue
- memory is optional and workspace-scoped

### Runtime contract

Technical spec for the deterministic, testable core. Implement against this; revise when learnings expose the need.

**1. Scope layer** – The authority/scope module (`src/lib/runtime/authority.ts`) is the deterministic core. Path normalization, path-in-scope checks, and policy violation checks are pure and testable; no LLM. Same inputs, same outputs.

**2. Task lifecycle** – Task states and allowed transitions are explicit; invalid transitions are rejected.

States: `queued` | `starting` | `running` | `retrying` | `succeeded` | `failed` | `canceled` | `stalled`

Allowed transitions:

- `queued` -> `starting`, `canceled`
- `starting` -> `running`, `retrying`, `failed`, `canceled`
- `running` -> `succeeded`, `failed`, `canceled`, `stalled`
- `retrying` -> `running`, `failed`, `canceled`
- `succeeded`, `failed`, `canceled`, `stalled` -> (terminal; no transitions)

**3. Events and failures** – FAP events from the harness are schema-validated. A line that looks like JSON (starts with `{`) and fails `AgentEvent.safeParse` fails the run with a protocol error. Process crash or unexpected exit always transitions the task to a terminal state (`failed` or `stalled`); the task is never left in `running`.

**4. Script-only runs** – Optional execution mode: run a fixed script (or command list) in the workspace with full scope enforcement; no harness/LLM; deterministic. Invoked via `POST /api/workspaces/:id/run/script` with `{ script: string, scope?: {...} }`. Returns the same structured result shape as agent runs where applicable.

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
bun run test
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
