#!/bin/bash
# Gate: mobile has an explicit move surface (not drag-only)

set -euo pipefail

cd "$(dirname "$0")/.."

FAILED=0

echo "=== Thread Move Mobile Gate ==="

echo -n "1. Tree exposes an explicit move dialog... "
if rg -n "Move thread|move-sheet|openMoveDialog" src/lib/components/session/AgentTree.svelte >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo -n "2. Tree nodes expose a move action affordance... "
if rg -n "aria-label=.*Move|tn-move|onrequestmove" src/lib/components/session/TreeNode.svelte >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo -n "3. Move dialog submits through the real move handler... "
if rg -n "submitMoveDialog|await onmove\\(" src/lib/components/session/AgentTree.svelte >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo
[ "$FAILED" -eq 0 ] && echo "✅ Thread move mobile gate passed" || echo "❌ Thread move mobile gate failed"
exit "$FAILED"
