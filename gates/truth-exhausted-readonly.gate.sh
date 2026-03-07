#!/bin/bash
# Gate: exhausted agents become read-only in the product surface

set -euo pipefail

cd "$(dirname "$0")/.."

FAILED=0

echo "=== Exhausted Readonly Gate ==="

echo -n "1. Protocol includes exhausted terminal status... "
if rg -n '"exhausted"' src/lib/protocol/events.ts >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo -n "2. ChatAgent marks handoff as exhausted... "
if rg -n 'persistStatus\("exhausted"\)|persistStatus\('"'exhausted'"'\)' src/agent/chat-agent.ts >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo -n "3. Session UI disables input when an agent is exhausted... "
if rg -n 'status === "exhausted"|disabled=\{isReadOnly\}' src/lib/components/session/AgentPanel.svelte src/lib/components/session/ChatInput.svelte >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo -n "4. Session page treats handoff as exhausted terminal state... "
if rg -n 'msg\.event\.type === "handoff".*exhausted|setNodeStatus\(nodeId, "exhausted"\)' src/routes/session/[id]/+page.svelte >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo
[ "$FAILED" -eq 0 ] && echo "✅ Exhausted readonly gate passed" || echo "❌ Exhausted readonly gate failed"
exit "$FAILED"
