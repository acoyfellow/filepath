#!/bin/bash
# E2E Chat Gate — verifies the full agent chat flow
# Self-sufficient: creates test user if doesn't exist

set -euo pipefail

# Detect dev server (API routes don't exist in SvelteKit dev)
if echo "${1:-}" | grep -qE "localhost:5173|127.0.0.1:5173"; then
  echo "⚠️  Dev server detected — E2E requires production or preview"
  echo "   Run against production: ./gates/e2e-chat.gate.sh"
  echo "   Or use preview: bun run build && bun run preview"
  echo ""
  echo "✅ E2E Chat Gate: SKIPPED (dev mode)"
  exit 0
fi

BASE_URL="${1:-https://myfilepath.com}"
API_URL="${2:-https://api.myfilepath.com}"
COOKIE_JAR=$(mktemp)
FAILED=0
SESSION_ID=""
NODE_ID=""

echo "=== E2E CHAT GATE ==="
echo "Target: $BASE_URL"
echo "API: $API_URL"
echo ""

# Test user credentials
TEST_EMAIL="${TEST_EMAIL:-test-e2e-1770332875@example.com}"
TEST_PASSWORD="${TEST_PASSWORD:-TestPass123!}"
TEST_NAME="E2E Test User"

# Step 1: Login (or create user if first run)
echo -n "1. Login... "
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
  -c "$COOKIE_JAR" --max-time 10 2>&1)
LOGIN_HTTP=$(echo "$LOGIN_RESP" | tail -1)

if [ "$LOGIN_HTTP" = "200" ]; then
  echo "PASS"
else
  # User doesn't exist - create it
  echo "User not found, creating..."
  
  SIGNUP_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/sign-up/email" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$TEST_NAME\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
    --max-time 10 2>&1)
  SIGNUP_HTTP=$(echo "$SIGNUP_RESP" | tail -1)
  
  if [ "$SIGNUP_HTTP" = "200" ] || [ "$SIGNUP_HTTP" = "201" ]; then
    echo "PASS (created user)"
    # Now login with the new user
    LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/sign-in/email" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
      -c "$COOKIE_JAR" --max-time 10 2>&1)
    LOGIN_HTTP=$(echo "$LOGIN_RESP" | tail -1)
    
    if [ "$LOGIN_HTTP" = "200" ]; then
      echo "  Login after signup: PASS"
    else
      echo "  Login after signup: FAIL (HTTP $LOGIN_HTTP)"
      FAILED=1
    fi
  else
    echo "FAIL (signup HTTP $SIGNUP_HTTP, login HTTP $LOGIN_HTTP)"
    FAILED=1
  fi
fi

# Step 2: Create session via tree API
echo -n "2. Create session... "
if [ $FAILED -eq 0 ]; then
  SESSION_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/sessions" \
    -H "Content-Type: application/json" \
    -b "$COOKIE_JAR" \
    -d '{"name":"E2E Chat Test","gitRepoUrl":""}' --max-time 10 2>&1)
  SESSION_HTTP=$(echo "$SESSION_RESP" | tail -1)
  SESSION_BODY=$(echo "$SESSION_RESP" | sed '$d')
  SESSION_ID=$(echo "$SESSION_BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null || echo "")

  if [ "$SESSION_HTTP" = "201" ] && [ -n "$SESSION_ID" ]; then
    echo "PASS (session: ${SESSION_ID:0:8}...)"
  else
    echo "FAIL (HTTP $SESSION_HTTP)"
    echo "  Body: $(echo "$SESSION_BODY" | head -c 200)"
    FAILED=1
    SESSION_ID=""
  fi
else
  echo "SKIP (login failed)"
fi

# Step 3: Spawn root agent node
echo -n "3. Spawn root agent... "
if [ -n "$SESSION_ID" ] && [ $FAILED -eq 0 ]; then
  NODE_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/sessions/$SESSION_ID/nodes" \
    -H "Content-Type: application/json" \
    -b "$COOKIE_JAR" \
    -d '{"agentType":"shelley","name":"Test Agent","model":"claude-sonnet-4"}' --max-time 10 2>&1)
  NODE_HTTP=$(echo "$NODE_RESP" | tail -1)
  NODE_BODY=$(echo "$NODE_RESP" | sed '$d')
  NODE_ID=$(echo "$NODE_BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null || echo "")
  
  if [ "$NODE_HTTP" = "201" ] && [ -n "$NODE_ID" ]; then
    echo "PASS (node: ${NODE_ID:0:8}...)"
  else
    echo "FAIL (HTTP $NODE_HTTP)"
    echo "  Body: $(echo "$NODE_BODY" | head -c 200)"
    FAILED=1
    NODE_ID=""
  fi
else
  echo "SKIP (no session)"
fi

# Step 4: WebSocket connection to ChatAgent DO
echo -n "4. WebSocket to ChatAgent DO... "
if [ -n "$NODE_ID" ] && [ $FAILED -eq 0 ]; then
  # Simple WebSocket test - just verify connection opens
  WS_RESULT=$(timeout 15 bun -e "
    const ws = new (require('ws'))('wss://$(echo $API_URL | sed 's|https://||')/agents/chat-agent/${NODE_ID}');
    ws.on('open', () => { console.log('CONNECTED'); ws.close(); process.exit(0); });
    ws.on('error', (e) => { console.log('ERROR:' + e.message); process.exit(1); });
    setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 10000);
  " 2>&1 || echo "TIMEOUT")
  
  if echo "$WS_RESULT" | grep -q 'CONNECTED'; then
    echo "PASS"
  else
    echo "FAIL ($WS_RESULT)"
    FAILED=1
  fi
else
  echo "SKIP (no node)"
fi

# Step 5: Config endpoint
echo -n "5. Config endpoint... "
CONFIG_RESP=$(curl -s "$BASE_URL/api/config" --max-time 5 2>&1)
CONFIG_URL=$(echo "$CONFIG_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('workerUrl',''))" 2>/dev/null || echo "")
if [ -n "$CONFIG_URL" ]; then
  echo "PASS (workerUrl: $CONFIG_URL)"
else
  echo "FAIL (response: $(echo $CONFIG_RESP | head -c 100))"
  FAILED=1
fi

# Cleanup
rm -f "$COOKIE_JAR"

echo ""
if [ $FAILED -eq 0 ]; then
  echo "✅ E2E Chat Gate: PASSED"
  exit 0
else
  echo "❌ E2E Chat Gate: FAILED ($FAILED step(s))"
  exit 1
fi
