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
- `delegate`

If an agent is not allowed to write, commit, or delegate, filepath should reject that action at runtime instead of relying on prompt wording.

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
- an MCP product
- a multi-user platform
- a child-agent tree runtime yet
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

Machine-readable reference:

- `/api/openapi.json`

### Authentication

Better Auth is the only supported auth boundary in v1.

- sign up and sign in through the app
- dashboard and API both use the Better Auth session
- no Cloudflare Access fallback
- no public unauthenticated product surface

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

The long-term product can support richer orchestration, but v1 should not fake a child-agent runtime before the stable Agents SDK supports it cleanly.

So v1 ships:

- human-created agents
- explicit file and tool scope
- persistent results
- no pretend tree runtime

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
5. revisit child-agent orchestration only after stable SDK support ships

### Delete aggressively

- stale session/node/tree language
- stale proof-engine language
- stale MCP/public-surface language
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
```

### Key files

- `src/core/app.ts`
- `src/lib/schema.ts`
- `src/lib/runtime/authority.ts`
- `src/lib/runtime/agent-runtime.ts`
- `src/routes/dashboard/+page.svelte`
- `src/routes/workspace/[id]/+page.svelte`
- `src/lib/components/session/SpawnModal.svelte`
- `src/routes/api/workspaces/`

### Repo rules

- destructive reset is allowed
- preserve only the current v1 workspace/agent story
- keep auth, API, UI, and runtime aligned to the same product vocabulary
- if a file still tells the old product story, rewrite it or delete it

### Future: child agents

Child-agent orchestration is out of scope for v1. Revisit only after the stable Cloudflare Agents SDK supports child agents. See Checklist → Out of bounds.
