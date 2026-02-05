# Known Issues - myfilepath.com

Last updated: Feb 2026

## Active Blockers

### Deja Memory Service
**Status:** ❌ Backend Bug  
**Impact:** Cannot store agent memories programmatically  
**Error:** `{"error":"this.client.prepare is not a function"}`  
**Endpoint:** POST https://deja.coey.dev/learn  
**Workaround:** None - requires backend fix  
**Tracking:** Backend team notified

```bash
# Reproducer:
curl -s -X POST https://deja.coey.dev/learn \
  -H "Authorization: Bearer $DEJA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"trigger": "test", "learning": "test", "confidence": 0.9}'
# Returns: {"error":"this.client.prepare is not a function"}
```

## Resolved Issues

### Svelte 4 → Svelte 5 Migration
**Status:** ✅ Fixed (Feb 4, 2026)  
**Issue:** Old `on:click` syntax in components  
**Fix:** Migrated to `onclick` syntax throughout

### Build Type Errors  
**Status:** ✅ Fixed (Feb 3, 2026)  
**Issue:** Various TypeScript errors  
**Fix:** Cleaned up types, build now passes

## Warnings (Non-Blocking)

### Container Workflow Integration
**Status:** 🔄 In Progress  
**Issue:** ExecuteTaskWorkflow uses mock container execution  
**Impact:** API orchestrator returns mock responses  
**Plan:** Integrate real container spawning

### WebSocket Progress Streaming
**Status:** 🔄 In Progress  
**Issue:** Progress streaming not yet implemented  
**Impact:** No real-time task updates  
**Plan:** Add WebSocket broadcast from workflows

## How to Report Issues

1. Check this file first
2. Add to this file with status, impact, and workaround
3. Include a reproducer if possible
