#!/bin/bash
# Tight WebSocket test - just step 4

set -euo pipefail

BASE_URL="${1:-https://myfilepath.com}"
API_URL="https://api.myfilepath.com"

# Check for ws module
if ! node -e "require('ws')" 2>/dev/null; then
  echo "❌ ws module not installed. Install with: npm i ws"
  exit 1
fi

# Login
echo "Logging in..."
COOKIES=$(mktemp)
curl -s -c "$COOKIES" -X POST "$BASE_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}" > /dev/null

echo "Logged in successfully"

# Create session
echo "Creating session..."
SESSION_RESP=$(curl -s -b "$COOKIES" -X POST "$BASE_URL/api/sessions" \
  -H "Content-Type: application/json" \
  -d '{"name":"tight-loop-test"}')
SESSION_ID=$(echo "$SESSION_RESP" | jq -r .id)
echo "Session: $SESSION_ID"

# Spawn agent
echo "Spawning agent..."
NODE_RESP=$(curl -s -b "$COOKIES" -X POST "$BASE_URL/api/sessions/$SESSION_ID/nodes" \
  -H "Content-Type: application/json" \
  -d '{"name":"test-agent", "agentType": "shelley", "model": "claude-sonnet-4"}')
NODE_ID=$(echo "$NODE_RESP" | jq -r .id)
echo "Node: $NODE_ID"

# WebSocket test
echo ""
echo "=== WebSocket Test ==="
WS_URL="wss://api.myfilepath.com/agents/chat-agent/$NODE_ID"
echo "Connecting to: $WS_URL"

timeout 20 node -e "
const WebSocket = require('ws');
const ws = new WebSocket('$WS_URL');

ws.on('open', () => {
  console.log('✅ Connected');
  ws.send(JSON.stringify({
    type: 'message',
    content: 'Say hello in one word',
    nodeId: '$NODE_ID',
    sessionId: '$SESSION_ID'
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('←', JSON.stringify(msg));
  if (msg.type === 'event' && msg.event?.type === 'text') {
    console.log('\\n✅ LLM RESPONSE:', msg.event.content);
    ws.close();
    process.exit(0);
  }
  if (msg.type === 'error') {
    console.log('\\n❌ ERROR:', msg.message);
    ws.close();
    process.exit(1);
  }
});

ws.on('error', (err) => {
  console.log('\\n❌ WS Error:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('\\n⏱️ TIMEOUT (15s)');
  ws.close();
  process.exit(1);
}, 15000);
" 2>&1

# Cleanup
rm -f "$COOKIES"
