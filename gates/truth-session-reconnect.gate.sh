#!/bin/bash
# Gate: structural proof that session state and history are reconnectable

set -euo pipefail

cd "$(dirname "$0")/.."

FAILED=0

echo "=== Session Reconnect Gate ==="

echo -n "1. Session page rebuilds tree from server-provided nodes... "
if rg -n "buildTree\\(data\\.nodes\\)" 'src/routes/session/[id]/+page.svelte' >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo -n "2. Session page handles history payloads from the DO... "
if rg -n "msg.type === 'history'" 'src/routes/session/[id]/+page.svelte' >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo -n "3. Session page reconnects the selected agent websocket... "
if rg -n "ensureConnection\\(selectedId\\)" 'src/routes/session/[id]/+page.svelte' >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo
[ "$FAILED" -eq 0 ] && echo "✅ Session reconnect structural gate passed" || echo "❌ Session reconnect structural gate failed"
exit "$FAILED"
