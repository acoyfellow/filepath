# Filepath Truth Matrix

This document is the audit source for user-facing product claims.

## Rule

- A claim can only be described as `True Today` once it has a passing gate.
- If a claim is only structural or partially implemented, it stays narrowed in copy or remains roadmap.

## Claims

| Claim | Surface | Status | Gate | Notes |
| --- | --- | --- | --- | --- |
| Cloudflare sandboxes with real isolation | `src/routes/+page.svelte` | Mostly true | `gates/truth-sandbox-isolation.gate.sh` | Structural proof exists; full live isolation proof still needs a runtime gate. |
| Supported harnesses, exact models, no extra lock-in | `src/routes/+page.svelte` | True with narrowed wording | `gates/no-fallback-runtime.gate.sh` | This is the current truthful scope, not arbitrary harness universality. |
| Durable session state that reconnects cleanly | `src/routes/+page.svelte` | Partially true | `gates/truth-session-reconnect.gate.sh` | Reconnect to the same session tree/history is what is currently proven. |
| Realtime session state across your devices | `src/routes/+page.svelte` | Partially true | `gates/truth-realtime-multi-client.gate.sh` | Same-account multi-client only. Not public sharing. |
| Visible runtime processes, plus a workspace terminal | `src/routes/+page.svelte` | Partially true | `gates/truth-process-visibility.gate.sh`, `gates/truth-terminal-workspace.gate.sh` | Process strip is visibility only; terminal is a workspace shell, not process-specific attach. |
| Cross-thread file handoff | `src/routes/+page.svelte` | Roadmap | none yet | Not implemented. |
| Move threads like files and folders | `src/routes/+page.svelte` | Roadmap | none yet | Backend move route exists; user-facing feature does not. |
| More routers, same contract | `src/routes/+page.svelte` | Roadmap | none yet | Intentionally deferred. |

## Additional Truth Constraints

- `src/app.html` must not mention artifact support until cross-thread file handoff is real.
- `src/lib/components/HeroDemo.svelte` must not imply public sharing or process-specific terminal attach.
- Runtime code must not include environment-based fallback execution paths for missing provider keys.
