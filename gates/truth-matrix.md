# Filepath Truth Matrix

This is the internal audit source for user-facing product claims.

## Rule

- A claim can only be described as `True Today` once it has a passing gate.
- If a claim is only structural or partially implemented, it stays narrowed in copy or remains roadmap.

## Claims

| Claim | Surface | Status | Gate | Notes |
| --- | --- | --- | --- | --- |
| Cloudflare sandboxes with real isolation | `src/routes/+page.svelte` | True | `gates/truth-sandbox-isolation.gate.sh`, `gates/truth-homepage-sync.gate.sh` | One agent maps to one sandboxed runtime boundary. |
| Supported harnesses, exact models, no extra lock-in | `src/routes/+page.svelte` | True with narrowed wording | `gates/no-fallback-runtime.gate.sh` | Current scope is supported harnesses plus exact model strings, not arbitrary universality. |
| Durable session state that reconnects cleanly | `src/routes/+page.svelte` | True with bounded wording | `gates/truth-session-reconnect.gate.sh`, `gates/truth-homepage-sync.gate.sh` | Reconnect to the same session tree/history is the current promise. |
| Realtime session state across your devices | `src/routes/+page.svelte` | True with bounded wording | `gates/truth-realtime-multi-client.gate.sh`, `gates/truth-homepage-sync.gate.sh` | Same-account multi-client only. Not public sharing. |
| Chat-first runtime visibility | `src/routes/+page.svelte` | True | `gates/production/agent-chat.gate.sh`, `gates/truth-homepage-sync.gate.sh` | Agent state, messages, tool calls, and exhaustion markers render in chat. |
| Exhausted agents become read-only | `src/routes/session/[id]/+page.svelte` | True | `gates/truth-exhausted-readonly.gate.sh` | Exhaustion is a terminal state that preserves history and disables new input. |
| Move agents like files and folders | `src/routes/+page.svelte` | True | `gates/truth-thread-move-desktop.gate.sh`, `gates/truth-thread-move-mobile.gate.sh`, `gates/truth-homepage-sync.gate.sh`, `gates/production/roadmap-truth.gate.sh` | Desktop drag/drop, mobile move sheet, realtime updates, and production runtime proof are in place. |
| More routers, same contract | `src/routes/+page.svelte` | Roadmap | none yet | Intentionally deferred. |

## Additional Truth Constraints

- `src/lib/components/HeroDemo.svelte` must not imply public sharing, terminal attach, or file handoff.
- Runtime code must not include environment-based fallback execution paths for missing provider keys.
