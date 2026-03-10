#!/bin/bash
# Browser repro gate for the exact session-page send flow:
# load session UI, type message, click send, and fail if the page shows
# "Cannot send: WebSocket closed" instead of rendering the user message.

set -euo pipefail

BASE_URL="${1:-${BASE_URL:-https://myfilepath.com}}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

TEST_EMAIL="${TEST_EMAIL:-test-e2e-1770332875@example.com}"
TEST_PASSWORD="${TEST_PASSWORD:-TestPass123!}"
TEST_OPENROUTER_KEY="${TEST_OPENROUTER_KEY:-${OPENROUTER_API_KEY:-}}"
TEST_MESSAGE="${TEST_MESSAGE:-Reply with exactly: GATE_PASS}"
TEST_HARNESS_ID="${TEST_HARNESS_ID:-shelley}"
TEST_MODEL="${TEST_MODEL:-anthropic/claude-sonnet-4}"
TEST_EXPECTED_REPLY="${TEST_EXPECTED_REPLY:-GATE_PASS}"

echo "=== BROWSER CHAT SEND REPRO ==="
echo "Target: $BASE_URL"
echo "Model:  $TEST_MODEL"
echo ""

if [ -z "$TEST_PASSWORD" ]; then
  echo "❌ TEST_PASSWORD not set"
  exit 1
fi

if [ -z "$TEST_OPENROUTER_KEY" ]; then
  echo "❌ TEST_OPENROUTER_KEY not set"
  exit 1
fi

echo -n "0. Ensure test user + router key... "
if bash "$SCRIPT_DIR/ensure-test-user.sh" "$BASE_URL" >/dev/null; then
  echo "PASS"
else
  echo "FAIL"
  exit 1
fi

echo -n "1. Drive browser send flow... "
if EXPECTED_REPLY="$TEST_EXPECTED_REPLY" node "$SCRIPT_DIR/../lib/repro-session-chat-send.mjs" \
  "$BASE_URL" \
  "$TEST_EMAIL" \
  "$TEST_PASSWORD" \
  "$TEST_MESSAGE" \
  "$TEST_HARNESS_ID" \
  "$TEST_MODEL" \
  "$TEST_EXPECTED_REPLY"; then
  echo "PASS"
  exit 0
fi

echo "FAIL"
exit 1
