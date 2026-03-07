#!/bin/bash
# Gate: mobile move path uses the same live move API plus an explicit move sheet UI

set -euo pipefail

BASE_URL="${1:-${BASE_URL:-http://localhost:5173}}"
COOKIE_JAR="$(mktemp)"
TEST_EMAIL="${TEST_EMAIL:-test-e2e-1770332875@example.com}"
TEST_PASSWORD="${TEST_PASSWORD:-TestPass123!}"

cleanup() {
  rm -f "$COOKIE_JAR"
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

echo "=== Thread Move Mobile Gate ==="
echo "Target: $BASE_URL"

LOGIN_HTTP="$(curl -s -o /tmp/filepath-login-mobile.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
  -c "$COOKIE_JAR")"
if [ "$LOGIN_HTTP" != "200" ]; then
  echo "FAIL (login HTTP $LOGIN_HTTP)"
  cat /tmp/filepath-login-mobile.json
  echo "Use TEST_EMAIL/TEST_PASSWORD for an existing test account."
  exit 1
fi

SESSION_ID="$(curl -s \
  -X POST "$BASE_URL/api/sessions" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d '{"name":"Truth Move Mobile"}' | json_field "id")"

NODE_A="$(curl -s \
  -X POST "$BASE_URL/api/sessions/$SESSION_ID/nodes" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d '{"harnessId":"custom","name":"Node A","model":"openai/gpt-5"}' | json_field "id")"
NODE_B="$(curl -s \
  -X POST "$BASE_URL/api/sessions/$SESSION_ID/nodes" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d '{"harnessId":"custom","name":"Node B","model":"openai/gpt-5"}' | json_field "id")"

if [ -z "$SESSION_ID" ] || [ -z "$NODE_A" ] || [ -z "$NODE_B" ]; then
  echo "FAIL (session or agent creation failed)"
  exit 1
fi

echo -n "1. Live move API accepts the mobile move-sheet payload... "
MOVE_HTTP="$(curl -s -o /tmp/filepath-mobile-move.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/sessions/$SESSION_ID/nodes/$NODE_B/move" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d "{\"parentId\":\"$NODE_A\",\"sortOrder\":0}")"
if [ "$MOVE_HTTP" = "200" ]; then
  echo "PASS"
else
  echo "FAIL (HTTP $MOVE_HTTP)"
  cat /tmp/filepath-mobile-move.json
  exit 1
fi

echo -n "2. Session tree reflects the mobile move result... "
TREE_BODY="$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/sessions/$SESSION_ID")"
TREE_OK="$(printf '%s' "$TREE_BODY" | python3 -c '
import json, sys
node_a, node_b = sys.argv[1], sys.argv[2]
data = json.load(sys.stdin)
tree = data.get("tree", [])
for node in tree:
    if node.get("id") == node_a:
        if any(child.get("id") == node_b for child in node.get("children", [])):
            print("1")
            raise SystemExit(0)
print("0")
' "$NODE_A" "$NODE_B")"
if [ "$TREE_OK" = "1" ]; then
  echo "PASS"
else
  echo "FAIL"
  echo "$TREE_BODY"
  exit 1
fi

echo -n "3. UI still exposes an explicit move sheet affordance... "
if rg -n "Move thread|openMoveDialog|onrequestmove" src/lib/components/session/AgentTree.svelte src/lib/components/session/TreeNode.svelte >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  exit 1
fi

echo "✅ Thread move mobile gate passed"
