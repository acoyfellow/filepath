#!/bin/bash
# Gate: no fallback runtime paths remain in shipped product code

set -euo pipefail

cd "$(dirname "$0")/.."

FAILED=0

echo "=== No Fallback Runtime Gate ==="

echo -n "1. ALLOW_ENV_KEY_FALLBACK removed... "
if rg -n "ALLOW_ENV_KEY_FALLBACK" src worker >/dev/null 2>&1; then
  echo "FAIL"
  FAILED=1
else
  echo "PASS"
fi

echo -n "2. ChatAgent still blocks direct model bypass... "
if rg -n "will not bypass the sandbox with a direct model call" src/agent/chat-agent.ts >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo -n "3. Missing router key fails explicitly... "
if rg -n "No valid API key available for the .* router" src/agent/chat-agent.ts >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo -n "4. Repo clone failure bubbles... "
if rg -n "Failed to clone the session repository into the sandbox workspace" src/lib/agents/container.ts src/agent/chat-agent.ts >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo -n "5. Container helpers do not return soft-fail success flags... "
if rg -n "success: false|success: true|return false" src/lib/agents/container.ts >/dev/null 2>&1; then
  echo "FAIL"
  FAILED=1
else
  echo "PASS"
fi

echo
[ "$FAILED" -eq 0 ] && echo "✅ No fallback runtime gate passed" || echo "❌ No fallback runtime gate failed"
exit "$FAILED"
