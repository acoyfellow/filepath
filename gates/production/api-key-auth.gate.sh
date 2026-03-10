#!/bin/bash
# Gate: Better Auth API key can drive the platform like an agent client

set -euo pipefail

BASE_URL="${1:-${BASE_URL:-https://myfilepath.com}}"
API_URL="${API_URL:-}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COOKIE_JAR=$(mktemp)

TEST_EMAIL="${TEST_EMAIL:-test-e2e-1770332875@example.com}"
TEST_PASSWORD="${TEST_PASSWORD:-TestPass123!}"
TEST_OPENROUTER_KEY="${TEST_OPENROUTER_KEY:-}"

cleanup() {
  rm -f "$COOKIE_JAR"
}
trap cleanup EXIT

echo "=== PRODUCTION GATE: API KEY AUTH ==="
echo "Target: $BASE_URL"
echo ""

echo -n "0. Ensure test user + router key... "
if bash "$SCRIPT_DIR/ensure-test-user.sh" "$BASE_URL" >/dev/null; then
  echo "PASS"
else
  echo "FAIL"
  exit 1
fi

echo -n "1. Login... "
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
  -c "$COOKIE_JAR" --max-time 15 2>&1)
LOGIN_HTTP=$(echo "$LOGIN_RESP" | tail -1)
if [ "$LOGIN_HTTP" = "200" ]; then
  echo "PASS"
else
  echo "FAIL (HTTP $LOGIN_HTTP)"
  exit 1
fi

echo -n "2. Create Better Auth API key... "
KEY_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/api-key/create" \
  -H "Content-Type: application/json" \
  -H "Origin: $BASE_URL" \
  -b "$COOKIE_JAR" \
  -d '{"name":"gate-agent-key","prefix":"mfp_","metadata":{"createdVia":"gate"}}' --max-time 15 2>&1)
KEY_HTTP=$(echo "$KEY_RESP" | tail -1)
KEY_BODY=$(echo "$KEY_RESP" | sed '$d')
API_KEY=$(echo "$KEY_BODY" | python3 -c "import json,sys; print(json.load(sys.stdin).get('key',''))" 2>/dev/null || echo "")
if ([ "$KEY_HTTP" = "200" ] || [ "$KEY_HTTP" = "201" ]) && [ -n "$API_KEY" ]; then
  echo "PASS"
else
  echo "FAIL (HTTP $KEY_HTTP, body: $(echo "$KEY_BODY" | head -c 200))"
  exit 1
fi

echo -n "3. List harnesses with API key... "
HARNESS_RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/harnesses" \
  -H "x-api-key: $API_KEY" --max-time 15 2>&1)
HARNESS_HTTP=$(echo "$HARNESS_RESP" | tail -1)
HARNESS_BODY=$(echo "$HARNESS_RESP" | sed '$d')
HARNESS_COUNT=$(echo "$HARNESS_BODY" | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('harnesses',[])))" 2>/dev/null || echo "0")
if [ "$HARNESS_HTTP" = "200" ] && [ "${HARNESS_COUNT:-0}" -gt 0 ]; then
  echo "PASS"
else
  echo "FAIL (HTTP $HARNESS_HTTP, body: $(echo "$HARNESS_BODY" | head -c 200))"
  exit 1
fi

echo -n "4. Create session with API key... "
SESSION_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/sessions" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"name":"gate-api-key-session"}' --max-time 15 2>&1)
SESSION_HTTP=$(echo "$SESSION_RESP" | tail -1)
SESSION_BODY=$(echo "$SESSION_RESP" | sed '$d')
SESSION_ID=$(echo "$SESSION_BODY" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
if ([ "$SESSION_HTTP" = "200" ] || [ "$SESSION_HTTP" = "201" ]) && [ -n "$SESSION_ID" ]; then
  echo "PASS ($SESSION_ID)"
else
  echo "FAIL (HTTP $SESSION_HTTP, body: $(echo "$SESSION_BODY" | head -c 200))"
  exit 1
fi

echo -n "5. Spawn agent with API key... "
NODE_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/sessions/$SESSION_ID/nodes" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"name":"gate-api-agent","harnessId":"shelley","model":"anthropic/claude-sonnet-4"}' --max-time 15 2>&1)
NODE_HTTP=$(echo "$NODE_RESP" | tail -1)
NODE_BODY=$(echo "$NODE_RESP" | sed '$d')
NODE_ID=$(echo "$NODE_BODY" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
if ([ "$NODE_HTTP" = "200" ] || [ "$NODE_HTTP" = "201" ]) && [ -n "$NODE_ID" ]; then
  echo "PASS ($NODE_ID)"
else
  echo "FAIL (HTTP $NODE_HTTP, body: $(echo "$NODE_BODY" | head -c 200))"
  exit 1
fi

echo -n "6. Resolve websocket worker URL... "
CONFIG_RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/config" --max-time 15 2>&1)
CONFIG_HTTP=$(echo "$CONFIG_RESP" | tail -1)
CONFIG_BODY=$(echo "$CONFIG_RESP" | sed '$d')
CONFIG_WORKER_URL=$(echo "$CONFIG_BODY" | python3 -c "import json,sys; print(json.load(sys.stdin).get('workerUrl',''))" 2>/dev/null || echo "")
if [ "$CONFIG_HTTP" = "200" ] && [ -n "$CONFIG_WORKER_URL" ]; then
  WORKER_URL="${API_URL:-$CONFIG_WORKER_URL}"
  echo "PASS ($WORKER_URL)"
else
  echo "FAIL (HTTP $CONFIG_HTTP, body: $(echo "$CONFIG_BODY" | head -c 200))"
  exit 1
fi

WORKER_WS_URL=""
case "$WORKER_URL" in
  https://*)
    WORKER_WS_URL="wss://${WORKER_URL#https://}"
    ;;
  http://*)
    WORKER_WS_URL="ws://${WORKER_URL#http://}"
    ;;
  *)
    WORKER_WS_URL="$WORKER_URL"
    ;;
esac

echo -n "7. WebSocket chat with API key token... "
CHAT_RESULT=$(EXPECTED_REPLY="API_KEY_PASS" timeout 30 node "$SCRIPT_DIR/../lib/send-chat-and-wait.mjs" \
  "${WORKER_WS_URL%/}/agents/chat-agent/$SESSION_ID?token=$API_KEY" \
  "$NODE_ID" \
  "$SESSION_ID" \
  "Reply with exactly: API_KEY_PASS" \
  "25000" 2>&1 || echo "TIMEOUT")
if echo "$CHAT_RESULT" | grep -q 'RESPONSE:'; then
  REPLY=$(echo "$CHAT_RESULT" | grep 'RESPONSE:' | sed 's/RESPONSE://')
  if [ "$REPLY" = "API_KEY_PASS" ]; then
    echo "PASS (reply: $REPLY)"
  else
    echo "FAIL (unexpected reply: $REPLY)"
    exit 1
  fi
else
  echo "FAIL ($CHAT_RESULT)"
  exit 1
fi

echo ""
echo "✅ API key auth gate: PASSED"
