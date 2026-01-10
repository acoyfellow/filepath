---
name: create-handoff
description: Creates detailed session handoffs for seamless continuity across sessions or between team members. Use when user says "create handoff", "wrap up", "done for today", or before ending significant work.
---

# Create Handoff Skill

## Purpose
Create a comprehensive handoff document that captures everything needed to resume work seamlessly in a fresh session or hand off to another developer.

## When to Use
Activate when user says:
- "create handoff"
- "wrap up for today"
- "done for today"
- "handoff to [name]"
- "before I leave"
- "document current progress"
- "prepare handoff"

## How It Works

### 1. Generate Session ID
```bash
SESSION_ID="handoff_$(date +%Y%m%d_%H%M%S)"
HANDOFF_DIR=".thoughts/shared/handoffs/$(basename "$(pwd")"
mkdir -p "$HANDOFF_DIR"
```

### 2. Analyze Current Session
Gather comprehensive context:
- **Work completed** - What was built/fixed
- **Current state** - Working vs broken
- **Next steps** - What to do next
- **Technical context** - Stack, patterns, conventions
- **Blockers** - Known issues, workarounds
- **Environment** - Local setup requirements
- **Tests** - What's tested, what's not
- **Documentation** - What exists, what's missing

### 3. Create Handoff Document
Create `.thoughts/shared/handoffs/[project]/handoff_[date]_[time].md`:

```markdown
# Handoff: [Session ID]

## Metadata
- **Date**: 2025-01-09
- **Time**: 17:45:00
- **Project**: [Project Name]
- **Handed off by**: [Developer Name]
- **Session Duration**: [Time]
- **Status**: [Active | Paused | Blocked]

---

## Executive Summary
[2-3 sentence overview of what was accomplished and what's next]

---

## Work Completed

### Features Implemented
1. **[Feature Name]**
   - Status: ✅ Complete | 🟡 Partial | ❌ Blocked
   - Files modified: [list]
   - Tests added: [yes/no]
   - Verification status: [passed/failed]

2. **[Feature Name]**
   - [same structure]

### Bugs Fixed
1. **[Bug Description]**
   - Root cause: [explanation]
   - Solution: [what was fixed]
   - Files modified: [list]
   - Verification: [how it was tested]

### Refactoring Completed
1. **[What was refactored]**
   - Why: [reason for refactoring]
   - Files changed: [list]
   - Impact: [what changed]
   - Tests: [status]

---

## Current State

### What Works
- [Feature 1]: [status]
- [Feature 2]: [status]
- [System]: [overall health]

### What Doesn't Work
- [Issue 1]: [description + blocker]
- [Issue 2]: [description + blocker]

### Known Issues
1. **[Issue Name]**
   - Severity: [Critical | High | Medium | Low]
   - Description: [what's wrong]
   - Impact: [who/what it affects]
   - Workaround: [if any]
   - Fix status: [Investigating | In Progress | Blocked]

---

## Next Steps

### Immediate (Next Session)
1. [ ] [Task 1] - [priority]
2. [ ] [Task 2] - [priority]

### Short-term (This Week)
1. [ ] [Task 3] - [priority]
2. [ ] [Task 4] - [priority]

### Long-term (This Sprint)
1. [ ] [Task 5] - [priority]
2. [ ] [Task 6] - [priority]

---

## Technical Context

### Tech Stack
- **Language**: TypeScript
- **Runtime**: Node.js 20
- **Frameworks**: [list]
- **Libraries**: [list]
- **Database**: [if applicable]

### Architecture
[Brief description of system architecture]

### Key Patterns
- **Pattern 1**: [description + file reference]
- **Pattern 2**: [description + file reference]

### Code Conventions
- **Type safety**: All code must be typed
- **Testing**: Test harnesses for critical paths
- **Commit**: Commit after each story completion

### File Structure
```
project/
├── worker/          # Cloudflare Workers
├── test/            # Test harnesses
├── scripts/         # Build/deployment scripts
└── alchemy.run.ts   # Infrastructure config
```

---

## Environment Setup

### Local Development
```bash
# Terminal 1: Container server
bun run dev:container  # ttyd on port 8085

# Terminal 2: Worker dev server
bun run dev           # Worker on port 8788
```

### Dependencies
```bash
# Install deps
bun install

# Type check
bun run typecheck

# Build
bun run build
```

### Environment Variables
- `ENV`: development | production
- Other env vars (if applicable)

---

## Testing Status

### Tests Passing
- ✅ [Test 1]: [description]
- ✅ [Test 2]: [description]

### Tests Failing
- ❌ [Test 1]: [description + error]
- ❌ [Test 2]: [description + error]

### Test Coverage
- Overall: [percentage]%
- Critical paths: [percentage]%

### How to Run Tests
```bash
# Run all tests
bun test

# Run specific test
bun test [file]
```

---

## Deployment Status

### Current Deployment
- **Environment**: [dev | staging | prod]
- **URL**: [if deployed]
- **Last deploy**: [date]
- **Commit**: [hash]

### Deployment Process
```bash
# Deploy to production
bun run deploy
```

---

## Important Notes

### Decisions Made
1. **[Decision]**
   - Why: [reasoning]
   - Tradeoffs: [what was given up]
   - Alternatives considered: [options]

### Lessons Learned
1. **[Lesson]**
   - What happened: [context]
   - Key insight: [takeaway]

### Gotchas / Edge Cases
1. **[Edge case]**
   - When it happens: [conditions]
   - How to handle: [solution]

### Performance Considerations
- [Performance note 1]
- [Performance note 2]

---

## Documentation Status

### Existing Documentation
- ✅ [AGENTS.md]: Project goals and rules
- ✅ [README.md]: Getting started
- ✅ [Other docs]: [list]

### Missing Documentation
- ⚠️ [What's missing]: [why it matters]

---

## References

### Related Issues
- Issue #[number]: [title]

### Pull Requests
- PR #[number]: [title]

### Commits
- [hash]: [message]

### External Resources
- [Link]: [description]

---

## Handoff Checklist

Before marking this handoff complete, verify:
- [ ] All completed work is documented
- [ ] Current state is accurate (works/doesn't work)
- [ ] Next steps are clear and actionable
- [ ] Blockers are documented with workarounds
- [ ] Environment setup instructions are complete
- [ ] Test status is documented (passing/failing)
- [ ] Deployment status is accurate
- [ ] Key decisions and tradeoffs are recorded
- [ ] All relevant files are referenced
- [ ] Notes include gotchas and edge cases

---

## Quick Start for Next Session

To resume work:
1. Read this handoff document
2. Check out the latest code: `git pull`
3. Start local dev: `bun run dev:container` and `bun run dev`
4. Verify: Run tests and manual checks
5. Begin with "Immediate" next steps

To pick up where we left off, say: **"resume from [handoff ID]"**
```

### 4. Save Handoff
```bash
HANDOFF_FILE="$HANDOFF_DIR/handoff_$(date +%Y%m%d_%H%M%S).md"
# Write handoff content to $HANDOFF_FILE
echo "✓ Handoff saved: $HANDOFF_FILE"
```

### 5. Confirm with User
```
✓ Handoff created: .thoughts/shared/handoffs/[project]/handoff_[date]_[time].md

Summary:
- 5 features implemented
- 2 bugs fixed
- 3 next steps documented
- 2 blockers identified
- All tests passing

Ready to end session or continue?
```

## What Makes a Good Handoff

### Essential
✓ Accurate current state (what works, what doesn't)
✓ Clear next steps (prioritized)
✓ Complete environment setup instructions
✓ Key decisions with reasoning
✓ Known blockers with workarounds

### Helpful
✓ Lessons learned
✓ Performance considerations
✓ Gotchas and edge cases
✓ Related issues/PRs/commits

### Unnecessary
✗ Failed attempts (unless lessons learned)
✗ Exploration that led nowhere
✗ Generic debugging output
✗ Personal opinions

## Handoff Types

### Session Continuity (Self Handoff)
- Focus: Next steps + current state
- Detail: High-level overview
- Goal: Resume quickly

### Team Handoff (Another Developer)
- Focus: Complete context transfer
- Detail: Comprehensive
- Goal: No questions needed

### Project Handoff (New Project Owner)
- Focus: Full project knowledge transfer
- Detail: Exhaustive
- Goal: Complete independence

## Token Efficiency Benefits

1. **Fresh context** - Next session starts clean, full signal
2. **No degradation** - Avoid "summary of summary" problem
3. **Parallel agents** - Background agents don't need history
4. **Focused resume** - Jump straight to next steps
5. **Lossless capture** - Only save what matters

## Usage Examples

### End of Day
```
User: "wrap up for today"
→ Create handoff
→ Save session state
→ Clear context
```

### Handoff to Teammate
```
User: "handoff to Sarah"
→ Create comprehensive handoff
→ Share file with Sarah
→ Sarah can resume immediately
```

### Context Clear
```
User: "save state before clearing"
→ Create handoff
→ Clear context
→ Resume with full signal
```
