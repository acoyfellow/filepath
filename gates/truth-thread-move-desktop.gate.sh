#!/bin/bash
# Gate: thread move works live, updates tree shape, and broadcasts realtime events

set -euo pipefail

BASE_URL="${1:-${BASE_URL:-http://localhost:5173}}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COOKIE_JAR="$(mktemp)"
EVENT_FILE="$(mktemp)"
TEST_EMAIL="${TEST_EMAIL:-test-e2e-1770332875@example.com}"
TEST_PASSWORD="${TEST_PASSWORD:-TestPass123!}"

cleanup() {
  rm -f "$COOKIE_JAR" "$EVENT_FILE"
}
trap cleanup EXIT

json_field() {
  local field="$1"
  python3 -c '
import json, sys
field = sys.argv[1]
try:
    data = json.load(sys.stdin)
except Exception:
    print("")
    raise SystemExit(0)
value = data
for part in field.split("."):
    if isinstance(value, dict):
        value = value.get(part, "")
    else:
        value = ""
        break
if value is None:
    value = ""
print(value)
' "$field"
}

to_ws_url() {
  python3 -c '
import sys
url = sys.argv[1]
if url.startswith("https://"):
    print("wss://" + url[len("https://"):])
elif url.startswith("http://"):
    print("ws://" + url[len("http://"):])
else:
    print(url)
' "$1"
}

echo "=== Thread Move Desktop Gate ==="
echo "Target: $BASE_URL"

LOGIN_HTTP="$(curl -s -o /tmp/filepath-login-move.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
  -c "$COOKIE_JAR")"
if [ "$LOGIN_HTTP" != "200" ]; then
  echo "FAIL (login HTTP $LOGIN_HTTP)"
  cat /tmp/filepath-login-move.json
  echo "Use TEST_EMAIL/TEST_PASSWORD for an existing test account."
  exit 1
fi

SESSION_ID="$(curl -s \
  -X POST "$BASE_URL/api/sessions" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d '{"name":"Truth Move"}' | json_field "id")"

create_node() {
  local name="$1"
  curl -s \
    -X POST "$BASE_URL/api/sessions/$SESSION_ID/nodes" \
    -H "Content-Type: application/json" \
    -b "$COOKIE_JAR" \
    -d "{\"agentType\":\"custom\",\"name\":\"$name\",\"model\":\"openai/gpt-5\"}"
}

ROOT_A="$(create_node "Root A" | json_field "id")"
ROOT_B="$(create_node "Root B" | json_field "id")"
ROOT_C="$(create_node "Root C" | json_field "id")"

if [ -z "$SESSION_ID" ] || [ -z "$ROOT_A" ] || [ -z "$ROOT_B" ] || [ -z "$ROOT_C" ]; then
  echo "FAIL (session or thread creation failed)"
  exit 1
fi

WORKER_URL="$(curl -s "$BASE_URL/api/config" | json_field "workerUrl")"
if [ -z "$WORKER_URL" ]; then
  echo "FAIL (worker URL unavailable)"
  exit 1
fi
WS_URL="$(to_ws_url "$WORKER_URL")/session-events/$SESSION_ID"
node "$SCRIPT_DIR/lib/wait-for-session-event.mjs" \
  "$WS_URL" \
  "tree_update" \
  "move" \
  "$EVENT_FILE" \
  "8000" &
WS_PID=$!
sleep 1

echo -n "1. Move thread under a new parent... "
MOVE_HTTP="$(curl -s -o /tmp/filepath-move.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/sessions/$SESSION_ID/nodes/$ROOT_B/move" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d "{\"parentId\":\"$ROOT_A\",\"sortOrder\":0}")"
if [ "$MOVE_HTTP" = "200" ]; then
  echo "PASS"
else
  echo "FAIL (HTTP $MOVE_HTTP)"
  cat /tmp/filepath-move.json
  kill "$WS_PID" 2>/dev/null || true
  exit 1
fi

wait "$WS_PID" || true

echo -n "2. Realtime tree_update move event was broadcast... "
if [ -s "$EVENT_FILE" ]; then
  echo "PASS"
else
  echo "FAIL"
  exit 1
fi

echo -n "3. Session tree reflects the new parentage... "
TREE_BODY="$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/sessions/$SESSION_ID")"
TREE_OK="$(printf '%s' "$TREE_BODY" | python3 -c '
import json, sys
root_a, root_b = sys.argv[1], sys.argv[2]
data = json.load(sys.stdin)
tree = data.get("tree", [])
for node in tree:
    if node.get("id") == root_a:
        for child in node.get("children", []):
            if child.get("id") == root_b:
                print("1")
                raise SystemExit(0)
print("0")
' "$ROOT_A" "$ROOT_B")"
if [ "$TREE_OK" = "1" ]; then
  echo "PASS"
else
  echo "FAIL"
  echo "$TREE_BODY"
  exit 1
fi

echo -n "4. Invalid cycle move is rejected... "
CYCLE_HTTP="$(curl -s -o /tmp/filepath-cycle.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/sessions/$SESSION_ID/nodes/$ROOT_A/move" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d "{\"parentId\":\"$ROOT_B\",\"sortOrder\":0}")"
if [ "$CYCLE_HTTP" != "200" ]; then
  echo "PASS"
else
  echo "FAIL"
  cat /tmp/filepath-cycle.json
  exit 1
fi

echo "✅ Thread move desktop gate passed"
