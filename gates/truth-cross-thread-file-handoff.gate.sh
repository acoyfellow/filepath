#!/bin/bash
# Gate: cross-thread file handoff has a real backend and visible UI surface

set -euo pipefail

cd "$(dirname "$0")/.."

FAILED=0

echo "=== Cross-Thread File Handoff Gate ==="

echo -n "1. Artifact schema exists... "
if rg -n "agentArtifact = sqliteTable|agent_artifact" src/lib/schema.ts migrations/0001_agent_artifact.sql >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo -n "2. Artifact API exists... "
if [ -f "src/routes/api/sessions/[id]/artifacts/+server.ts" ]; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo -n "3. Explicit export/import helpers exist... "
if rg -n "exportArtifactFromContainer|importArtifactToContainer" src/lib/agents/container.ts >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo -n "4. Session UI exposes a send-file action... "
if rg -n "Send File To\\.\\.\\.|Send file to another thread" src/lib/components/session/AgentPanel.svelte >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo
[ "$FAILED" -eq 0 ] && echo "✅ Cross-thread file handoff gate passed" || echo "❌ Cross-thread file handoff gate failed"
exit "$FAILED"
