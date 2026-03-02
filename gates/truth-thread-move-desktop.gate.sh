#!/bin/bash
# Gate: desktop thread movement has backend, realtime event, and drag/drop UI

set -euo pipefail

cd "$(dirname "$0")/.."

FAILED=0

echo "=== Thread Move Desktop Gate ==="

echo -n "1. Move API exists... "
if [ -f "src/routes/api/sessions/[id]/nodes/[nodeId]/move/+server.ts" ]; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo -n "2. Move API broadcasts tree_update move events... "
if rg -n 'type: "tree_update"|action: "move"' 'src/routes/api/sessions/[id]/nodes/[nodeId]/move/+server.ts' >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo -n "3. Tree nodes are draggable... "
if rg -n "draggable=\"true\"|ondragstart|ondrop" src/lib/components/session/TreeNode.svelte >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo -n "4. Session page listens for move events... "
if rg -n "tree_update'.*move|refreshSessionSnapshot\\(" 'src/routes/session/[id]/+page.svelte' >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo
[ "$FAILED" -eq 0 ] && echo "✅ Thread move desktop gate passed" || echo "❌ Thread move desktop gate failed"
exit "$FAILED"
