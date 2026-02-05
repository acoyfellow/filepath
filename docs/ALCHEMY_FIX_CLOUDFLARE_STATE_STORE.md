# Alchemy CloudflareStateStore forceUpdate Fix

## Problem

When using `forceUpdate: true` in `CloudflareStateStore`, Alchemy updates the state store worker but **does not clear the cached state data** in the Durable Object's SQLite storage.

This causes deployment failures when:
- Resources are manually deleted/recreated with new IDs (D1 databases, workers, DOs)
- Alchemy tries to reconcile state with actual resources
- Old resource IDs are still in state, causing 404 errors on delete attempts

### Real-World Example (myfilepath.com)

1. D1 database existed with UUID `3fc71d65-c2e2-44af-bdf6-1b1b3a6cdc99`
2. User manually deleted database and created new one: `11c62299-1d8c-418f-b250-ff2598c699c6`
3. Changed `ALCHEMY_STATE_TOKEN` to force update
4. Deployment failed with:
   ```
   ERROR Failed to delete D1 database "3fc71d65-c2e2-44af-bdf6-1b1b3a6cdc99" (404 Not Found)
   ```
5. Even with `forceUpdate: true`, old database ID persisted in state

### Root Cause

`forceUpdate: true` only affects **worker deployment**, not **state data**:

```typescript
// In cloudflare-state-store.ts provision()
if (!settings || !settings.tags.includes(bundle.tag) || options.forceUpdate) {
  logger.log(`[CloudflareStateStore] ${settings ? "Updating" : "Creating"}...`);
  await putWorker(api, { ... }); // Updates worker
}
// But never clears the state data in the DO!
```

The state data lives in a separate Durable Object and persists across worker updates.

## Solution

### 1. Add `clearScope` Operation

**File:** `alchemy/src/state/operations.ts`

```typescript
async clearScope() {
  // Delete all resources in the current scope
  await this.db
    .delete(schema.resources)
    .where(eq(schema.resources.scope, this.context.chain));
}
```

Adds a new state operation that deletes all resources for a given scope chain.

### 2. Invoke clearScope on forceUpdate

**File:** `alchemy/src/state/cloudflare-state-store.ts`

```typescript
async provision(): Promise<StateStoreProxy.Dispatch> {
  const { url, token } = await provision(this.options);
  
  // If forceUpdate is enabled, clear the state for this scope
  if (this.options.forceUpdate) {
    logger.log(`[CloudflareStateStore] forceUpdate enabled - clearing state for scope ${this.scope.chain.join('/')}`);
    const clearRequest: StateStoreProxy.Request<'clearScope', { chain: string[] }> = {
      method: 'clearScope' as any,
      params: [] as any,
      context: { chain: this.scope.chain },
    };
    const clearResponse = await safeFetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(clearRequest),
    });
    if (clearResponse.ok) {
      logger.log(`[CloudflareStateStore] State cleared successfully`);
    } else {
      logger.warn(`[CloudflareStateStore] Failed to clear state: ${clearResponse.status}`);
    }
  }
  
  return async (method, params) => { ... };
}
```

When `forceUpdate: true`, automatically clears the scope's state before proceeding with deployment.

### 3. Add clearScope to Dispatch Handler

**File:** `alchemy/src/state/operations.ts`

```typescript
case "clearScope": {
  return this.clearScope();
}
```

Routes the new method in the dispatch switch.

## Testing

Tested on real project (myfilepath.com) with actual D1 database ID mismatch:

**Before fix:**
```
[ERROR] Scope failed filepath/prod/filepath-db
[ERROR] Failed to delete D1 database "3fc71d65..." (404 Not Found)
```

**After fix:**
```
[CloudflareStateStore] forceUpdate enabled - clearing state for scope filepath/prod/filepath-sandbox
[CloudflareStateStore] State cleared successfully
[updated] filepath-sandbox Updated Resource
```

## Benefits

1. **Actually forces update** - `forceUpdate: true` now does what users expect
2. **Recovers from manual changes** - Can reset state when resources are manually modified
3. **Clear error recovery** - Provides escape hatch when state gets out of sync
4. **Backwards compatible** - Only activates when `forceUpdate: true`
5. **Scope-isolated** - Only clears current scope, not entire state store

## Migration Notes

**For Alchemy maintainers:**
- This change requires updating the deployed `alchemy-state-service` worker
- The new `clearScope` method won't exist in existing deployments
- Users will see "Failed to clear state: 500" until worker is updated
- After worker update, existing `forceUpdate: true` usages will start clearing state

**For Alchemy users:**
- No code changes required
- `forceUpdate: true` will now actually clear state (breaking if you relied on old behavior)
- Recommended: Use `forceUpdate: true` only when intentionally resetting state
- Alternative: Delete `ALCHEMY_STATE_TOKEN` env var to force complete reset

## Branch & PR Info

**Branch:** `fix/cloudflare-state-store-force-update-clear-scope`

**Files Changed:**
- `alchemy/src/state/cloudflare-state-store.ts` (+24 lines)
- `alchemy/src/state/operations.ts` (+9 lines)

**Total:** 33 lines added, 0 removed

**Commit:** `58fd2076`

## Next Steps

1. ✅ Created fix and tested locally
2. ✅ Committed to feature branch
3. ⏳ Create PR to alchemy-run/alchemy
4. ⏳ Address review feedback
5. ⏳ Wait for merge and release
6. ⏳ Update myfilepath-new to use new alchemy version

## Documentation Updates Needed

After merge, update Alchemy docs:

**Page:** `guides/cloudflare-state-store`

**Add section:**
```markdown
### Resetting State with forceUpdate

If your state gets out of sync with actual resources (e.g., you manually deleted
a D1 database), you can use `forceUpdate: true` to clear the scope's state:

\`\`\`typescript
const app = await alchemy("my-app", {
  stateStore: (scope) => new CloudflareStateStore(scope, { 
    forceUpdate: true  // Clears state for this deployment
  }),
});
\`\`\`

**Warning:** This deletes all state for the current scope. Resources will be
recreated from scratch, potentially causing downtime.
```
