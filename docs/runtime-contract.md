# Runtime Contract

Micro plan for the deterministic, testable core. See README "Runtime contract" for the user-facing spec.

## Scope Layer

- [x] `src/lib/runtime/authority.ts` is the deterministic core
- [x] Path normalization, path-in-scope checks, policy violation checks are pure
- [x] Unit tests in `src/lib/runtime/authority.test.ts`; run `bun test`

## Task Lifecycle

- [x] States: `queued` | `starting` | `running` | `retrying` | `succeeded` | `failed` | `canceled` | `stalled`
- [x] Transitions enforced in `patchTaskRow` via `isValidTaskTransition`
- [x] Invalid transitions throw `RuntimeTaskError("INVALID_TASK_TRANSITION", ...)`

## Events and Failures

- [x] FAP lines starting with `{` that fail `AgentEvent.safeParse` → `FAP_PROTOCOL_ERROR`, fail the run
- [x] Process crash/unexpected exit → `finalizeTaskFailure` → terminal state (`failed`/`stalled`)

## Script-Only Runs

- [x] `POST /api/workspaces/:id/run/script` with `{ script: string, scope?: {...} }`
- [x] Reuses workspace mount and scope enforcement
- [x] Returns same structured result shape; `agentId` empty, `events` empty
