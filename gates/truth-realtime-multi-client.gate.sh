#!/bin/bash
# Gate: structural proof that the UI is wired for same-account multi-client realtime updates

set -euo pipefail

cd "$(dirname "$0")/.."

FAILED=0

echo "=== Realtime Multi-Client Gate ==="

echo -n "1. Session page maintains active websocket clients... "
if rg -n 'activeClients = \$state' 'src/routes/session/[id]/+page.svelte' >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo -n "2. DO event stream updates local chat state... "
if rg -n "msg.type === 'event'" 'src/routes/session/[id]/+page.svelte' >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo -n "3. Tree updates from the DO are handled... "
if rg -n "msg.type === 'tree_update'" 'src/routes/session/[id]/+page.svelte' >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo
[ "$FAILED" -eq 0 ] && echo "✅ Realtime multi-client structural gate passed" || echo "❌ Realtime multi-client structural gate failed"
exit "$FAILED"
