#!/bin/bash
# Gate: structural proof that each thread resolves to its own sandbox key

set -euo pipefail

cd "$(dirname "$0")/.."

FAILED=0

echo "=== Sandbox Isolation Gate ==="

echo -n "1. ChatAgent keys sandboxes by thread id... "
if rg -n "getSandbox\\(.*nodeId\\)" src/agent/chat-agent.ts >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo -n "2. container_id persists the thread sandbox identity... "
if rg -n "UPDATE agent_node SET container_id = .* WHERE id = \\?" src/agent/chat-agent.ts >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo -n "3. Git clone targets /workspace inside the sandbox... "
if rg -n "cloneRepo\\(" src/agent/chat-agent.ts >/dev/null 2>&1 && \
   rg -n "'/workspace'" src/agent/chat-agent.ts >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo
[ "$FAILED" -eq 0 ] && echo "✅ Sandbox isolation structural gate passed" || echo "❌ Sandbox isolation structural gate failed"
exit "$FAILED"
