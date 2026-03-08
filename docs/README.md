# docs/

Markdown in this folder is now for repository and operational notes only.

User-facing product docs increasingly live in the app routes under `src/routes/docs/`. This folder should keep only markdown that is still useful to maintainers and does not contradict shipped behavior.

## Keepers

| Document | Purpose |
|----------|---------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Deploy checklist and environment notes |
| [ALCHEMY_FIX_CLOUDFLARE_STATE_STORE.md](./ALCHEMY_FIX_CLOUDFLARE_STATE_STORE.md) | Infra-specific Alchemy note |
| [ALCHEMY_PR_CHECKLIST.md](./ALCHEMY_PR_CHECKLIST.md) | PR/deploy checklist |
| [HOWTO-Custom-Agent.md](./HOWTO-Custom-Agent.md) | BYO harness guidance |
| [HOWTO-Debug-Containers.md](./HOWTO-Debug-Containers.md) | Container debugging workflow |
| [passkey-implementation-guide.md](./passkey-implementation-guide.md) | Passkey implementation notes |

## Root Docs

| File | Purpose |
|------|---------|
| [../README.md](../README.md) | Project overview |
| [../NORTHSTAR.md](../NORTHSTAR.md) | Current product truth and direction |
| [../AGENTS.md](../AGENTS.md) | Repo rules for coding agents |

## Cleanup Rule

Delete markdown docs when they describe:

- removed product surfaces
- old auth or key models
- dead APIs
- architecture that no longer exists
- plans that conflict with the current gates
