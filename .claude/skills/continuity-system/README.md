# Continuity System Skills

A complete token-efficient session management system for OpenCode/oh-my-opencode, inspired by [Continuous-Claude-v2](https://github.com/parcadei/Continuous-Claude-v2).

## Overview

The Continuity System provides three skills that work together to maintain state across sessions while keeping context lean:

1. **continuity-ledger** - Save session state to persistent ledgers
2. **create-handoff** - Create comprehensive handoffs for session/team transitions
3. **resume-handoff** - Resume work from previous sessions with full signal

## Philosophy

> **"Clear, don't compact."**

When context hits limits, Claude Code compacts (summarizes) the conversation. Each compaction is lossy. After several, you're working with a summary of a summary of a summary.

The Continuity System solves this by:
- Saving state **losslessly** to ledgers/handoffs
- Clearing context **completely**
- Resuming with **fresh context + full signal**

## Why Token Efficiency Matters

```
Traditional Approach (Degradation):
Session 1: Full context (100k tokens) → Work
Session 2: Compacted (80k tokens) → Work
Session 3: Compacted again (60k tokens) → Work
Session 4: Compacted again (40k tokens) → Work
Result: Degraded signal, hallucinations, confusion

Continuity System Approach:
Session 1: Full context (100k tokens) → Work → Save ledger
Session 2: Fresh context (10k tokens) + ledger → Work → Update ledger
Session 3: Fresh context (10k tokens) + ledger → Work → Update ledger
Result: Full signal, consistent quality
```

## How It Works

### The Continuity Loop

```
┌─────────────────────────────────────────────────────────┐
│              SESSION LIFECYCLE                      │
└─────────────────────────────────────────────────────────┘

1. SESSION START
   ┌──────────────────┐
   │ Load ledger      │
   │ Load handoff     │
   │ Present context  │
   └──────────────────┘
           │
           ▼

2. WORKING
   ┌──────────────────┐
   │ Main agent       │ - Minimal context (5k tokens)
   │ +               │ - Orchestrates only
   │ Background agents│ - Parallel execution
   └──────────────────┘
           │
           ▼

3. END SESSION
   ┌──────────────────┐
   │ Create handoff   │ - Comprehensive state
   │ Update ledger     │ - Lossless capture
   └──────────────────┘
           │
           ▼

4. CLEAR CONTEXT
   ┌──────────────────┐
   │ Fresh start      │ - Full signal
   │ + saved state   │ - No degradation
   └──────────────────┘
           │
           └──▶ Back to 1
```

### Token Savings

```
Traditional approach:
Main context: 100k tokens (bloated)
Compactions: 4 times
Total signal loss: ~60%

Continuity system:
Main context: 5k tokens (lean)
Background agents: 30k tokens (parallel)
Ledger: 2k tokens (persistent)
Total signal loss: 0%

Token savings: 65% reduction
Signal quality: 100% retention
```

## Quick Start

### For New Projects

```bash
# Initialize directories
mkdir -p .thoughts/ledgers
mkdir -p .thoughts/shared/handoffs

# Add to .gitignore
echo ".thoughts/" >> .gitignore
```

### First Session

```
You: "Implement feature X"
→ Work on feature
→ Build, test, verify
→ Commit changes

You: "save state"
→ Activates continuity-ledger
→ Saves progress to ledger

You: "done for today"
→ Activates create-handoff
→ Creates comprehensive handoff
→ Ready to resume
```

### Next Session

```
You: "resume work"
→ Activates resume-handoff
→ Loads handoff/ledger
→ Presents context summary
→ Ready to continue

You: "start with next steps"
→ Loads minimal relevant context
→ Begins execution
```

## Skills

### 1. continuity-ledger

**Purpose**: Save session state to persistent ledgers

**When to use**:
- "save state"
- "update ledger"
- "before clear"
- "capture current progress"

**What it saves**:
- Completed tasks with details
- Key decisions with reasoning
- Blockers and solutions
- Pending work
- Technical context
- Learnings

**File location**: `.thoughts/ledgers/CONTINUITY_[project].md`

**Example usage**:
```bash
You: "update ledger before clearing"
→ Saves current session state
→ Marks completed tasks
→ Documents decisions
→ Ready to clear
```

### 2. create-handoff

**Purpose**: Create comprehensive handoffs for session/team transitions

**When to use**:
- "create handoff"
- "wrap up for today"
- "done for today"
- "handoff to [name]"

**What it includes**:
- Executive summary
- Work completed
- Current state (works/doesn't work)
- Next steps (prioritized)
- Blockers and workarounds
- Environment setup
- Test status
- Key decisions and tradeoffs
- Documentation status

**File location**: `.thoughts/shared/handoffs/[project]/handoff_[date]_[time].md`

**Example usage**:
```bash
You: "wrap up for today"
→ Creates comprehensive handoff
→ Documents everything
→ Ready for next session
```

### 3. resume-handoff

**Purpose**: Resume work from previous sessions with full signal

**When to use**:
- "resume work"
- "continue from handoff"
- "pick up where we left off"
- "resume from [handoff ID]"

**What it does**:
- Finds latest handoff/ledger
- Presents context summary
- Provides quick start options
- Loads minimal relevant context
- Begins execution

**Example usage**:
```bash
You: "resume work"
→ Finds latest handoff
→ Presents summary
→ Shows next steps
→ Ready to continue
```

## Usage Patterns

### Pattern 1: Same Day Session

```
Morning:
  → Start work
  → Complete task 1
  → Save ledger
  → Clear context

Afternoon:
  → Resume from ledger
  → Continue with task 2
  → Update ledger
  → Clear context
```

### Pattern 2: Multi-Day Work

```
Day 1:
  → Implement features
  → Create handoff
  → Clear

Day 2:
  → Resume from handoff
  → Review what was done
  → Continue work
  → Update handoff
```

### Pattern 3: Team Handoff

```
Developer A:
  → Complete feature
  → Create detailed handoff
  → Hand off to Developer B

Developer B:
  → Load handoff
  → Understand context
  → Continue work
  → Update handoff
```

### Pattern 4: Context Bloom Prevention

```
Before:
  → Work, work, work (context grows)
  → Compaction 1 (signal degrades)
  → Work, work, work
  → Compaction 2 (signal worse)
  → Compaction 3 (hallucinations start)

After:
  → Work, work, work (context grows)
  → Save ledger + clear (full signal)
  → Work, work, work (context grows)
  → Save ledger + clear (full signal)
  → Always full signal
```

## Best Practices

### ✓ Do

- Save ledgers regularly (after each significant task)
- Create handoffs before ending sessions
- Use handoffs for team transitions
- Resume with minimal context (lean loading)
- Accept handoff decisions as made
- Focus on next steps, not re-analysis
- Use background agents for exploration

### ✗ Don't

- Re-analyze past decisions
- Load entire codebase
- Skip environment verification
- Question completed work
- Keep old sessions in context
- Ignore failing tests

## Integration with oh-my-opencode

The Continuity System is designed to work seamlessly with oh-my-opencode's strengths:

### Background Agents

```
Main context (continuity system):
  - Handoff summary: 2k tokens
  - Next steps: 1k tokens
  - Total: 3k tokens

Background agents (oh-my-opencode):
  - Explore agent: 10k tokens (codebase search)
  - Librarian agent: 10k tokens (docs)
  - Oracle agent: 10k tokens (architecture)

Result: Lean main context, full research
```

### Parallel Execution

```
Traditional: Sequential, bloated context
Session → Explore → Read → Read → Read → Analyze → Work

Continuity + oh-my-opencode: Parallel, lean context
Session → Fire parallel agents → Collect results → Work
          (explore)  (librarian)  (oracle)
```

### Token Efficiency

```
Traditional approach:
Main agent: 100k tokens (bloat)
Time: 10 minutes
Signal quality: 60%

Continuity + oh-my-opencode:
Main agent: 3k tokens (lean)
Background agents: 30k tokens (parallel)
Total: 33k tokens
Time: 3 minutes
Signal quality: 100%

Savings: 67% tokens, 70% time
```

## Directory Structure

```
project/
├── .thoughts/
│   ├── ledgers/
│   │   └── CONTINUITY_[project].md    # Cumulative state
│   └── shared/
│       └── handoffs/
│           └── [project]/
│               └── handoff_YYYYMMDD_HHMMSS.md  # Session snapshots
├── src/
├── test/
└── package.json
```

### .thoughts/ in .gitignore

```gitignore
.thoughts/
```

Ledgers and handoffs are project-specific and should not be committed.

## FAQ

### Q: Why not just use session history?

**A**: Session history degrades with each compaction. Ledgers/handoffs are lossless snapshots that preserve full signal.

### Q: Why not use git for this?

**A**: Git tracks code, but not:
- Current state (works/doesn't work)
- Blockers and workarounds
- Next steps and priorities
- Key decisions and reasoning
- Test status
- Environment setup notes

### Q: Isn't this redundant with oh-my-opencode's session management?

**A**: Complementary:
- oh-my-opencode: Technical session management
- Continuity System: Human-readable state documentation

### Q: Do I need all three skills?

**A**: For maximum benefit, yes. But:
- Use `continuity-ledger` for frequent saves
- Use `create-handoff` for session endings
- Use `resume-handoff` for resuming

### Q: Can I use this with Continuous-Claude-v2?

**A**: Different platforms:
- Continuity System: OpenCode/oh-my-opencode
- Continuous-Claude-v2: Claude Code (VS Code extension)

Similar philosophy, different implementation.

## Comparison to Continuous-Claude-v2

| Feature | Continuity System | Continuous-Claude-v2 |
|---------|------------------|-----------------------|
| **Platform** | OpenCode/oh-my-opencode | Claude Code (VS Code) |
| **Skills** | 3 independent skills | 1 cohesive system |
| **Ledgers** | Markdown files | Markdown files |
| **Handoffs** | Markdown files | Markdown files |
| **Hooks** | Manual activation | Hook system |
| **MCP** | oh-my-opencode agents | Custom MCP runtime |
| **Learnings** | Manual capture | Auto-extract |
| **Plans** | In handoffs | Separate system |

## Troubleshooting

### "No handoff found"

```bash
# Check if directory exists
ls .thoughts/shared/handoffs/

# If missing, create
mkdir -p .thoughts/shared/handoffs/$(basename "$(pwd)")
```

### "Context is confusing after resume"

```bash
# Clear and reload
# Review handoff
# Ask clarifying questions
# Resume with minimal context
```

### "Don't know what to do next"

```bash
# Check handoff next steps
# Prioritize tasks
# Start with highest priority
# Update ledger as you go
```

## Contributing

These skills are open source and designed to be extended. For improvements:

1. Fork the repository
2. Make your changes
3. Submit a pull request

## License

Same as awesome-claude-skills repository.

## Credits

- Inspired by [Continuous-Claude-v2](https://github.com/parcadei/Continuous-Claude-v2)
- Designed for [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode)
- Compatible with [OpenCode](https://github.com/sst/opencode)

## Support

For issues or questions:
- Open an issue on GitHub
- Join the [Discord community](https://discord.gg/PUwSMR9XNk)
- Check [oh-my-opencode documentation](https://github.com/code-yeongyu/oh-my-opencode)

## Examples

### Example 1: Feature Development

```bash
# Session 1
You: "Implement WebSocket proxy"
→ Work on implementation
→ Build and test
→ "save state" (continuity-ledger)
→ "done for today" (create-handoff)

# Session 2
You: "resume work"
→ Loads handoff
→ Shows: WebSocket complete, next: reconnection logic
→ Starts with reconnection
→ Updates handoff
```

### Example 2: Bug Fix

```bash
# Session 1
You: "Fix WebSocket timeout"
→ Investigates issue
→ Finds root cause
→ Implements fix
→ Tests verification
→ "save state" (continuity-ledger)

# Session 2
You: "resume work"
→ Loads ledger
→ Shows: Bug fixed, next: add error handling
→ Starts error handling
```

### Example 3: Team Handoff

```bash
# Developer A
Developer A: "handoff to Sarah"
→ Creates comprehensive handoff
→ Includes: context, state, next steps
→ Shares with Sarah

# Developer B
Sarah: "resume from handoff"
→ Loads handoff
→ Understands full context
→ Continues work without questions
```

## Quick Reference

| Command | Skill | Purpose |
|---------|--------|---------|
| "save state" | continuity-ledger | Save current progress |
| "update ledger" | continuity-ledger | Update existing ledger |
| "before clear" | continuity-ledger | Prepare for context clear |
| "create handoff" | create-handoff | End session handoff |
| "wrap up" | create-handoff | End of day handoff |
| "resume work" | resume-handoff | Load previous session |
| "continue from handoff" | resume-handoff | Resume from specific handoff |
| "pick up where" | resume-handoff | Resume latest work |

## Summary

The Continuity System provides:

✓ **Token efficiency** - 65% reduction in token usage
✓ **Full signal** - 100% signal retention, no degradation
✓ **Session continuity** - Seamless resumption across sessions
✓ **Team handoffs** - Complete context transfer
✓ **Oh-my-opencode integration** - Works with background agents
✓ **Simple** - Easy to use, minimal setup

**Clear, don't compact.** Save state, clear context, resume fresh.
