#!/bin/bash
# Gate: process visibility remains real and non-synthetic

set -euo pipefail

cd "$(dirname "$0")/.."

FAILED=0

echo "=== Process Visibility Gate ==="

echo -n "1. Process endpoint exists... "
if [ -f "src/routes/api/sessions/[id]/nodes/[nodeId]/processes/+server.ts" ]; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo -n "2. Threads without a container return empty processes... "
if rg -n "return json\\(\\{ processes: \\[\\] \\}\\);" 'src/routes/api/sessions/[id]/nodes/[nodeId]/processes/+server.ts' >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo -n "3. Process contract no longer implies per-process attach... "
if rg -n "attachable|attachedPath" src/lib/types/session.ts src/lib/components/session/AgentPanel.svelte src/lib/components/HeroDemo.svelte worker/agent.ts >/dev/null 2>&1; then
  echo "FAIL"
  FAILED=1
else
  echo "PASS"
fi

echo
[ "$FAILED" -eq 0 ] && echo "✅ Process visibility gate passed" || echo "❌ Process visibility gate failed"
exit "$FAILED"
