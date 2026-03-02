#!/bin/bash
# Gate: terminal attach is explicitly a workspace-terminal feature

set -euo pipefail

cd "$(dirname "$0")/.."

FAILED=0

echo "=== Terminal Workspace Gate ==="

echo -n "1. Worker exposes terminal meta route... "
if rg -n "metaRoute === 'meta'" worker/agent.ts >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo -n "2. Missing container returns 409 from worker terminal route... "
if rg -n "status: 409" worker/agent.ts >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo -n "3. UI labels terminal attach as workspace terminal... "
if rg -n "Open Workspace Terminal" src/lib/components/session/AgentPanel.svelte >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo
[ "$FAILED" -eq 0 ] && echo "✅ Terminal workspace gate passed" || echo "❌ Terminal workspace gate failed"
exit "$FAILED"
