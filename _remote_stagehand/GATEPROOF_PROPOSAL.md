# Observability Improvements for gateproof

## Context

We're dogfooding `gateproof` in our `filepath` project's `prd.ts` (gate-driven development). While building our orchestration layer, we added observability features that would benefit all `gateproof` users.

## Current Pain Points

1. **No persistent logs** - Gate output is streamed but not saved, making debugging failures harder
2. **Limited failure context** - When gates fail, you see the error but not the last N lines of output that led to it
3. **No watch mode** - Must manually rerun gates during development
4. **Output capture inflexibility** - Can't easily capture/suppress output for CI or debugging

## Proposed Features

### 1. Automatic Log File Saving

**Problem**: Gate output is ephemeral - once it streams, it's gone. Hard to debug failures later.

**Solution**: Optionally save gate execution output to log files.

```typescript
Gate.run({
  name: 'my-gate',
  observe: createEmptyObserveResource(),
  act: [...],
  assert: [...],
  report: 'pretty',
  // NEW OPTIONS:
  logFile: '.gateproof/logs/my-gate.log', // optional path
  logOnFailure: true, // always log failures even if logFile not set
})
```

**Benefits**:
- Debug failures after the fact
- CI/CD artifact collection
- Historical gate execution records

### 2. Enhanced Failure Diagnostics

**Problem**: When a gate fails, you see the error but not the context (last N lines of output) that led to it.

**Solution**: Automatically show last N lines of output on failure.

```typescript
Gate.run({
  name: 'my-gate',
  // ... existing options
  // NEW OPTIONS:
  failureDiagnostics: {
    showLastLines: 50, // show last N lines of output on failure
    showFullOutput: false, // optionally show full output
  }
})
```

**Output format** (when gate fails):
```
✗ FAIL

┌─ Diagnostics (last 50 lines) ─────────────────────────────────────────────┐
│ [gateproof] Act.exec: bun run test.ts                                    │
│ [gateproof] Error: Command failed with exit code 1                        │
│ [test] Running test suite...                                              │
│ [test] FAIL: test/example.test.ts:42 - expected "foo" got "bar"          │
│ ...                                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Benefits**:
- Faster debugging - see what happened right before failure
- Better CI output - context without scrolling through full logs

### 3. Watch Mode

**Problem**: During gate development, must manually rerun gates after changes.

**Solution**: CLI watch mode that auto-reruns gates on file changes.

```bash
# Watch a single gate file
gateproof --watch gates/my-gate.ts

# Watch all gates in a directory
gateproof --watch gates/

# Watch with debounce (wait 500ms after last change)
gateproof --watch gates/ --debounce 500
```

**Benefits**:
- Faster iteration during gate development
- Immediate feedback on changes

### 4. Output Capture Options

**Problem**: Can't easily suppress or redirect output for different use cases (CI, debugging, etc.).

**Solution**: Configurable output capture and redirection.

```typescript
Gate.run({
  name: 'my-gate',
  // ... existing options
  // NEW OPTIONS:
  output: {
    capture: true, // capture stdout/stderr (default: false, streams directly)
    suppress: false, // suppress output to console (useful for CI)
    redirect: 'file', // 'console' | 'file' | 'both'
  }
})
```

**Benefits**:
- Cleaner CI output (suppress, log to file)
- Better debugging (capture for analysis)
- Flexible for different environments

## Implementation Notes

### Log File Saving
- Create log directory if it doesn't exist
- Append timestamp to log files (optional)
- Support log rotation (optional, future)

### Failure Diagnostics
- Only show on failure (don't clutter success output)
- Respect `report` option (e.g., 'json' vs 'pretty')
- Make line count configurable (default: 50)

### Watch Mode
- Use platform-native file watching (fs.watch on Node, Bun.watch on Bun)
- Debounce file changes (default: 500ms)
- Clear indication when watching starts/stops

### Output Capture
- Backward compatible (default: current behavior)
- Capture happens at `Act.exec` level (already has output)
- Support for all report formats

## Migration Path

All features are **opt-in** and **backward compatible**:

- Existing gates work unchanged
- New options are optional
- Default behavior matches current behavior

## Example: Complete Usage

```typescript
// Development: watch mode + diagnostics
gateproof --watch gates/my-gate.ts

// CI: log files + suppressed output
Gate.run({
  name: 'my-gate',
  logFile: 'ci-logs/my-gate.log',
  output: { suppress: true },
  failureDiagnostics: { showLastLines: 50 },
  // ... rest of gate
})

// Debugging: full output + logs
Gate.run({
  name: 'my-gate',
  logFile: '.gateproof/logs/my-gate.log',
  failureDiagnostics: { showFullOutput: true },
  // ... rest of gate
})
```

## Benefits Summary

1. **Faster debugging** - See context on failures, persistent logs
2. **Better CI/CD** - Clean output, artifact collection
3. **Better DX** - Watch mode for faster iteration
4. **Flexibility** - Configurable for different environments

## Questions / Considerations

1. Should log files be in a standard location (`.gateproof/logs/`) or fully configurable?
2. Should watch mode be a CLI-only feature or also available programmatically?
3. Should failure diagnostics be enabled by default or opt-in?
4. Do we need log rotation/cleanup for long-running CI?

---

**Proposed by**: filepath project (dogfooding gateproof)  
**Date**: 2026-01-23  
**gateproof version**: 0.1.1
