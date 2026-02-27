#!/bin/bash
# End-to-End Test: Create Session + Spawn PI Agent
# Usage: ./test-pi-agent.sh [BASE_URL] [API_KEY]

set -euo pipefail

BASE_URL="${1:-http://localhost:5173}"
API_KEY="${2:-}"
COOKIE_JAR=$(mktemp)
FAILED=0

echo "=== END-TO-END PI AGENT TEST ==="
echo "Target: $BASE_URL"
echo ""

# For local dev, you need to be logged in. For production, use API key.
if [ -z "$API_KEY" ]; then
  echo "⚠️  No API key provided. For production, set your OpenRouter key:"
  echo "   ./test-pi-agent.sh https://myfilepath.com sk-or-v1-..."
  echo ""
fi

# Step 1: Create Session
echo -n "1. Create session... "
SESSION_PAYLOAD='{"name":"PI Research Test"}'
if [ -n "$API_KEY" ]; then
  # Use API key auth for production
  SESSION_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/sessions" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $API_KEY" \
    -d "$SESSION_PAYLOAD" --max-time 10 2>&1)
else
  # Use cookie auth for local dev (assumes you're logged in)
  SESSION_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/sessions" \
    -H "Content-Type: application/json" \
    -b "$COOKIE_JAR" \
    -d "$SESSION_PAYLOAD" --max-time 10 2>&1)
fi

SESSION_HTTP=$(echo "$SESSION_RESP" | tail -1)
SESSION_BODY=$(echo "$SESSION_RESP" | sed '$d')
SESSION_ID=$(echo "$SESSION_BODY" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")

if [ "$SESSION_HTTP" = "201" ] && [ -n "$SESSION_ID" ]; then
  echo "✅ PASS (session: $SESSION_ID)"
else
  echo "❌ FAIL (HTTP $SESSION_HTTP)"
  echo "   Body: $(echo "$SESSION_BODY" | head -c 200)"
  FAILED=1
  rm -f "$COOKIE_JAR"
  exit 1
fi

# Step 2: Spawn PI Agent
echo -n "2. Spawn PI agent... "
AGENT_PAYLOAD="{
  \"name\": \"Research Assistant\",
  \"agentType\": \"pi\",
  \"model\": \"anthropic/claude-sonnet-4\",
  \"config\": {
    \"systemPrompt\": \"You are Pi, a research specialist. Provide concise, accurate answers.\"
  }
}"

if [ -n "$API_KEY" ]; then
  AGENT_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/sessions/$SESSION_ID/nodes" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $API_KEY" \
    -d "$AGENT_PAYLOAD" --max-time 10 2>&1)
else
  AGENT_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/sessions/$SESSION_ID/nodes" \
    -H "Content-Type: application/json" \
    -b "$COOKIE_JAR" \
    -d "$AGENT_PAYLOAD" --max-time 10 2>&1)
fi

AGENT_HTTP=$(echo "$AGENT_RESP" | tail -1)
AGENT_BODY=$(echo "$AGENT_RESP" | sed '$d')
AGENT_ID=$(echo "$AGENT_BODY" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")

if [ "$AGENT_HTTP" = "201" ] && [ -n "$AGENT_ID" ]; then
  echo "✅ PASS (agent: $AGENT_ID)"
else
  echo "❌ FAIL (HTTP $AGENT_HTTP)"
  echo "   Body: $(echo "$AGENT_BODY" | head -c 200)"
  FAILED=1
fi

# Step 3: WebSocket Connection Test
echo -n "3. WebSocket connection... "
WS_URL="${BASE_URL/api\/sessions/api}/agents/chat-agent/pi-test-${AGENT_ID}"
# Convert http to ws
WS_URL=$(echo "$WS_URL" | sed 's/^http/ws/')

# Use Node.js/bun to test WebSocket
WS_RESULT=$(timeout 10 bun -e "
  const ws = new (require('ws'))('$WS_URL');
  let connected = false;
  ws.on('open', () => { 
    console.log('CONNECTED'); 
    // Send a test message
    ws.send(JSON.stringify({
      type: 'cf_agent_use_chat_request',
      id: 'test-123',
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ id: '1', role: 'user', parts: [{ type: 'text', text: 'What is 2+2?' }] }] })
      }
    }));
  });
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'cf_agent_use_chat_response') {
      if (msg.body) console.log('RESPONSE:', msg.body.slice(0, 100));
      if (msg.done) { console.log('DONE'); ws.close(); process.exit(0); }
    }
  });
  ws.on('error', (e) => { console.log('ERROR:', e.message); process.exit(1); });
  setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 8000);
" 2>&1 || echo "TIMEOUT")

if echo "$WS_RESULT" | grep -q 'CONNECTED'; then
  echo "✅ PASS"
  if echo "$WS_RESULT" | grep -q 'RESPONSE'; then
    echo "   $(echo "$WS_RESULT" | grep 'RESPONSE' | head -1)"
  fi
else
  echo "❌ FAIL"
  echo "   $WS_RESULT"
  FAILED=1
fi

# Cleanup
rm -f "$COOKIE_JAR"

echo ""
echo "=== SUMMARY ==="
echo "Session ID: $SESSION_ID"
echo "Agent ID: $AGENT_ID"
echo "Agent Type: pi (Research specialist)"
echo "Model: anthropic/claude-sonnet-4"
echo ""
if [ $FAILED -eq 0 ]; then
  echo "✅ All tests PASSED"
  echo ""
  echo "Next steps:"
  echo "  1. Open browser: $BASE_URL/session/$SESSION_ID"
  echo "  2. Click on 'Research Assistant' in the tree"
  echo "  3. Start chatting!"
  exit 0
else
  echo "❌ $FAILED test(s) FAILED"
  exit 1
fi
