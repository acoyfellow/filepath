#!/bin/bash
# NORTH STAR GATE: Login → Create session → Spawn agent → Send message → Get LLM response
# This is THE gate. If this passes, the demo works.
#
# Usage: ./gates/production/agent-chat.gate.sh [base_url]
# Env: TEST_EMAIL, TEST_PASSWORD

set -euo pipefail

BASE_URL="${1:-${BASE_URL:-https://myfilepath.com}}"
API_URL="${API_URL:-https://api.myfilepath.com}"
COOKIE_JAR=$(mktemp)
FAILED=0

TEST_EMAIL="${TEST_EMAIL:-jordan@sendgrowth.com}"
TEST_PASSWORD="${TEST_PASSWORD:-}"

if [ -z "$TEST_PASSWORD" ]; then
  echo "❌ TEST_PASSWORD not set"
  exit 1
fi

echo "=== PRODUCTION GATE: AGENT CHAT E2E ==="
echo "Target: $BASE_URL"
echo ""

# Step 1: Login
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
  FAILED=$((FAILED + 1))
fi

# Step 2: Create session via API
echo -n "2. Create session... "
SESSION_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/sessions" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d '{"name": "gate-test-'"$(date +%s)"'"}' --max-time 15 2>&1)
SESSION_HTTP=$(echo "$SESSION_RESP" | tail -1)
SESSION_BODY=$(echo "$SESSION_RESP" | sed '$d')
SESSION_ID=$(echo "$SESSION_BODY" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")

if ([ "$SESSION_HTTP" = "200" ] || [ "$SESSION_HTTP" = "201" ]) && [ -n "$SESSION_ID" ]; then
  echo "PASS (session: $SESSION_ID)"
else
  echo "FAIL (HTTP $SESSION_HTTP, body: $(echo $SESSION_BODY | head -c 200))"
  FAILED=$((FAILED + 1))
  SESSION_ID=""
fi

# Step 3: Spawn agent node
NODE_ID=""
if [ -n "$SESSION_ID" ]; then
  echo -n "3. Spawn agent... "
  NODE_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/sessions/$SESSION_ID/nodes" \
    -H "Content-Type: application/json" \
    -b "$COOKIE_JAR" \
    -d '{"name": "gate-agent", "agentType": "shelley", "model": "claude-sonnet-4"}' --max-time 15 2>&1)
  NODE_HTTP=$(echo "$NODE_RESP" | tail -1)
  NODE_BODY=$(echo "$NODE_RESP" | sed '$d')
  NODE_ID=$(echo "$NODE_BODY" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")

  if ([ "$NODE_HTTP" = "200" ] || [ "$NODE_HTTP" = "201" ]) && [ -n "$NODE_ID" ]; then
    echo "PASS (node: $NODE_ID)"
  else
    echo "FAIL (HTTP $NODE_HTTP, body: $(echo $NODE_BODY | head -c 200))"
    FAILED=$((FAILED + 1))
    NODE_ID=""
  fi
else
  echo "3. Spawn agent... SKIP (no session)"
fi

# Step 4: WebSocket connect + send message + get response
if [ -n "$NODE_ID" ] && [ -n "$SESSION_ID" ]; then
  echo -n "4. Chat: send message + get LLM response... "
  
  # Check if ws module is available
  if ! node -e "require('ws')" 2>/dev/null; then
    echo "SKIP (ws module not installed — run 'npm i ws' to enable)"
  else
  CHAT_RESULT=$(timeout 30 node -e "
    const WebSocket = require('ws');
    const ws = new WebSocket('wss://$(echo $API_URL | sed 's|https://||')/agents/chat-agent/$NODE_ID');
    let gotResponse = false;
    
    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'message',
        content: 'Reply with exactly: GATE_PASS',
        nodeId: '$NODE_ID',
        sessionId: '$SESSION_ID'
      }));
    });
    
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'event' && msg.event && msg.event.type === 'text') {
          console.log('RESPONSE:' + msg.event.content.substring(0, 100));
          gotResponse = true;
          ws.close();
          process.exit(0);
        }
        if (msg.type === 'error') {
          console.log('ERROR:' + msg.message);
          ws.close();
          process.exit(1);
        }
      } catch(e) {}
    });
    
    ws.on('error', (e) => {
      console.log('WS_ERROR:' + e.message);
      process.exit(1);
    });
    
    setTimeout(() => {
      if (!gotResponse) {
        console.log('TIMEOUT');
        process.exit(1);
      }
    }, 25000);
  " 2>&1 || echo "TIMEOUT")

  if echo "$CHAT_RESULT" | grep -q 'RESPONSE:'; then
    REPLY=$(echo "$CHAT_RESULT" | grep 'RESPONSE:' | sed 's/RESPONSE://')
    echo "PASS (reply: $REPLY)"
  else
    echo "FAIL ($CHAT_RESULT)"
    FAILED=$((FAILED + 1))
  fi
  fi
else
  echo "4. Chat... SKIP (no node)"
fi

# Cleanup
rm -f "$COOKIE_JAR"

echo ""
if [ $FAILED -eq 0 ]; then
  echo "✅ Agent Chat E2E Gate: PASSED"
  exit 0
else
  echo "❌ Agent Chat E2E Gate: FAILED ($FAILED step(s))"
  exit 1
fi
