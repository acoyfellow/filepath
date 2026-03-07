#!/bin/bash
# Tight WebSocket test - just step 4

set -euo pipefail

BASE_URL="${1:-https://myfilepath.com}"
API_URL="https://api.myfilepath.com"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

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
  -d '{"name":"test-agent", "harnessId": "shelley", "model": "claude-sonnet-4"}')
NODE_ID=$(echo "$NODE_RESP" | jq -r .id)
echo "Node: $NODE_ID"

# WebSocket test
echo ""
echo "=== WebSocket Test ==="
WS_URL="wss://api.myfilepath.com/agents/chat-agent/$NODE_ID"
echo "Connecting to: $WS_URL"

timeout 20 node "$SCRIPT_DIR/../lib/send-chat-and-wait.mjs" \
  "$WS_URL" \
  "$NODE_ID" \
  "$SESSION_ID" \
  "Say hello in one word" \
  "15000" 2>&1

# Cleanup
rm -f "$COOKIES"
