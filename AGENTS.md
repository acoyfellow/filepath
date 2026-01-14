# AGENTS.md - RALPH Loop Metadata

## Overview

RALPH (Read, Act, Learn, Plan, Halt) is a self-perpetuating development loop pattern that automates iterative development while maintaining strict safeguards and constraints.

## Loop Pattern

Each iteration follows this cycle:

1. **Read**: Parse `scripts/ralph/prd.json` and `scripts/ralph/progress.txt` to understand current state
2. **Act**: Select highest priority pending story and implement minimal changes
3. **Learn**: Record results in `scripts/ralph/progress.txt` and any failures in `scripts/ralph/failure.json`
4. **Plan**: Determine next story based on priority and dependencies
5. **Halt**: Stop iteration and commit if guards pass, otherwise diagnose and record failure

## State Files

- `scripts/ralph/prd.json` - Product backlog with prioritized stories
- `scripts/ralph/progress.txt` - Iteration history and completion tracking
- `scripts/ralph/constraints.json` - Implementation rules and safeguards
- `scripts/ralph/failure.json` - Diagnostic logs for failed iterations
- `.opencode/opencode.json` - Agent configuration and workflow settings

## Guard Constraints

Pre-commit validation via `scripts/ralph/guard.sh`:

- ✅ No secrets or API keys in commits
- ✅ File size limits (<500KB)
- ✅ Reasonable iteration scope (<10 files)
- ✅ No untracked source files
- ⚠️  Build/test validation (manual)

## Implementation Rules

**Architecture Preservation**:
- Maintain Durable Objects pattern (SessionStateDO, TabStateDO, TabBroadcastDO)
- Keep Svelte 5 runes ($state, $derived, $effect)
- Preserve WebSocket-based terminal communication
- No breaking API changes

**Code Quality**:
- TypeScript strict mode
- Minimal abstractions (simple > clever)
- Update documentation with changes

**Dependencies**:
- Only add when strictly necessary
- Security check all new dependencies
- Prefer ecosystem tools

## Triggering Iterations

**Manual**: 
```bash
# Run one iteration manually
cd scripts/ralph && ./guard.sh && echo "Guards passed"
```

**Automated** (via GitHub Actions):
- Workflow: `.github/workflows/ralph.yml`
- Trigger: On push to `ralph/*` branches or manual dispatch
- Conditions: At least one pending story in prd.json

## Termination Conditions

Loop halts when:
- All stories marked "completed"
- Guard constraint violations detected
- No pending stories with "status": "pending"
- Manual halt via workflow_dispatch input

## Monitoring

Check loop health:
```bash
# View current stories
cat scripts/ralph/prd.json | jq '.stories[] | select(.status != "completed")'

# View recent progress
tail -20 scripts/ralph/progress.txt

# Check for failures
cat scripts/ralph/failure.json | jq '.failures[-5:]'
```
