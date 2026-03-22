# Contributing

Thanks for helping improve filepath.

## Getting started

```bash
git clone https://github.com/acoyfellow/filepath.git
cd filepath
bun install
```

Copy `.env.example` to `.env` and fill values needed for local development.

## Checks before you push

```bash
bun run lint
bun run check
bun test
```

CI runs `check`, `lint`, and `build` on pushes.

## Pull requests

- Keep changes focused on one concern when possible.
- Note any user-visible behavior or deployment impact in the PR description.
- If you change runtime or API behavior, update tests or smoke scripts where applicable.

## Code style

- TypeScript and Svelte 5; match existing patterns in the tree.
- Prefer fixing root causes over silencing errors without context.
