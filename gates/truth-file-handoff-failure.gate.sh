#!/bin/bash
# Gate: file handoff failure is explicitly represented, not hidden

set -euo pipefail

cd "$(dirname "$0")/.."

FAILED=0

echo "=== File Handoff Failure Gate ==="

echo -n "1. Failed artifact status exists in schema/type surface... "
if rg -n "\"failed\"|failed" src/lib/types/session.ts src/lib/schema.ts src/routes/api/sessions/[id]/artifacts/+server.ts >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo -n "2. Artifact API records errorMessage on failure... "
if rg -n "errorMessage" 'src/routes/api/sessions/[id]/artifacts/+server.ts' >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo -n "3. Artifact UI renders failure text... "
if rg -n "artifact\\.errorMessage|Artifact transfer failed" src/lib/components/session/AgentPanel.svelte src/routes/session/[id]/+page.svelte >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo
[ "$FAILED" -eq 0 ] && echo "✅ File handoff failure gate passed" || echo "❌ File handoff failure gate failed"
exit "$FAILED"
