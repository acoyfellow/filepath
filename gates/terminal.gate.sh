#!/bin/bash
# Terminal E2E Gate - tests full terminal flow
# Usage: ./gates/terminal.gate.sh [base_url]

set -e

BASE_URL="${1:-https://api.myfilepath.com}"
SESSION_ID="gate-test-$(date +%s)"
TAB_ID="tab1"

echo "=== Terminal Gate Tests ==="
echo "Base URL: $BASE_URL"
echo "Session: $SESSION_ID"
echo ""

# Gate 1: Session state endpoint
echo "[Gate 1] Session state endpoint..."
RESPONSE=$(curl -sf "$BASE_URL/session/$SESSION_ID/state")
echo "$RESPONSE" | jq -e '.tabs' > /dev/null || { echo "FAIL: Invalid session state"; exit 1; }
echo "PASS"

# Gate 2: Terminal start
echo "[Gate 2] Terminal start..."
RESPONSE=$(curl -sf -X POST "$BASE_URL/terminal/$SESSION_ID/$TAB_ID/start")
echo "$RESPONSE" | jq -e '.success == true' > /dev/null || { echo "FAIL: Terminal start failed"; exit 1; }
TERMINAL_ID=$(echo "$RESPONSE" | jq -r '.terminalId')
echo "PASS (terminalId: $TERMINAL_ID)"

# Gate 3: Terminal HTML page
echo "[Gate 3] Terminal HTML page..."
RESPONSE=$(curl -sf "$BASE_URL/terminal/$SESSION_ID/tab?tab=$TAB_ID")
echo "$RESPONSE" | grep -q 'xterm.js' || { echo "FAIL: Terminal HTML missing xterm.js"; exit 1; }
echo "$RESPONSE" | grep -q 'api.myfilepath.com' || { echo "FAIL: Terminal HTML not using api.myfilepath.com"; exit 1; }
echo "PASS"

# Gate 4: WebSocket upgrade (requires websocat or similar)
echo "[Gate 4] WebSocket endpoint..."
if command -v websocat &> /dev/null; then
  # Test actual WebSocket connection
  TIMEOUT=10
  WS_URL="wss://api.myfilepath.com/terminal/$SESSION_ID/$TAB_ID/ws"
  RESULT=$(timeout $TIMEOUT websocat -t "$WS_URL" <<< '{"columns":80,"rows":24}' 2>&1 | head -c 100 || true)
  if [ -n "$RESULT" ]; then
    echo "PASS (got response: ${RESULT:0:50}...)"
  else
    echo "FAIL: No WebSocket response within ${TIMEOUT}s"
    exit 1
  fi
else
  echo "SKIP (websocat not installed)"
fi

echo ""
echo "=== All gates passed ==="
