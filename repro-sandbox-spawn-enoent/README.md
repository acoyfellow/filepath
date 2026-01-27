# sandbox-sdk spawn ENOENT reproduction

Deep diagnostic repro for https://github.com/cloudflare/sandbox-sdk/issues/309.

## The bug

`spawnSync()` returns ENOENT on a binary that provably exists — `accessSync()` passes on the same path. Works locally, fails in production Cloudflare containers.

## Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /repro` | Original spawn ENOENT repro (hello shell script) |
| `GET /diagnostics` | Deep filesystem/ELF/linker diagnostics (`file`, `ldd`, `readelf`, `xxd`, linker paths) |
| `GET /spawn-test` | Static vs dynamic vs script `spawnSync` — isolates linking issue |
| `GET /workerd-compat` | workerd `child_process` compat matrix (`execSync`, `shell:true`, `/bin/ls`) |
| `GET /delay-test?delay=30` | Startup-window hypothesis (PR #364) — wait N seconds then spawn |

All endpoints accept `?id=<sandbox-id>` to control which sandbox instance is used (default: `repro`).

## Container test binaries

The Dockerfile builds four binaries:

| Binary | Type |
|---|---|
| `/usr/local/bin/hello` | Shell script (`#!/bin/sh`) |
| `/usr/local/bin/hello-script` | Shell script (`#!/bin/sh`) |
| `/usr/local/bin/hello-static` | Statically linked C binary (`gcc -static`) |
| `/usr/local/bin/hello-dynamic` | Dynamically linked C binary (`gcc`) |

## What the diagnostics tell you

- **If static works but dynamic doesn't** → missing ELF linker/shared libs in container
- **If none work** → workerd `child_process` platform limitation
- **If `shell:true` fixes it** → PATH resolution issue in workerd's spawn
- **If delay fixes it** → startup-window error misreported as ENOENT (PR #364 would help)
- **If `/bin/ls` fails** → fundamental workerd restriction on `child_process`

## Run

```bash
npm install
npm run dev
```

```bash
curl -s http://localhost:8787/diagnostics | jq
curl -s http://localhost:8787/spawn-test | jq
curl -s http://localhost:8787/workerd-compat | jq
curl -s http://localhost:8787/delay-test?delay=5 | jq
```

## Deploy

```bash
npm run deploy
curl -s https://sandbox-spawn-enoent-repro.<account>.workers.dev/diagnostics | jq
```
