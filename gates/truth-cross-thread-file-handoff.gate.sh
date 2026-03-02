#!/bin/bash
# Gate: cross-thread file handoff works against a live stack

set -euo pipefail

BASE_URL="${1:-${BASE_URL:-http://localhost:5173}}"
COOKIE_JAR="$(mktemp)"
TEST_EMAIL="${TEST_EMAIL:-test-e2e-1770332875@example.com}"
TEST_PASSWORD="${TEST_PASSWORD:-TestPass123!}"
TEST_REPO_URL="https://github.com/octocat/Spoon-Knife.git"

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

echo "=== Cross-Thread File Handoff Gate ==="
echo "Target: $BASE_URL"

echo -n "1. Login... "
LOGIN_HTTP="$(curl -s -o /tmp/filepath-login.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
  -c "$COOKIE_JAR")"
if [ "$LOGIN_HTTP" = "200" ]; then
  echo "PASS"
else
  echo "FAIL (HTTP $LOGIN_HTTP)"
  cat /tmp/filepath-login.json
  echo "Use TEST_EMAIL/TEST_PASSWORD for an existing test account."
  exit 1
fi

echo -n "2. Create repo-backed session... "
SESSION_BODY="$(curl -s \
  -X POST "$BASE_URL/api/sessions" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d "{\"name\":\"Truth Handoff\",\"gitRepoUrl\":\"$TEST_REPO_URL\"}")"
SESSION_ID="$(printf '%s' "$SESSION_BODY" | json_field "id")"
if [ -n "$SESSION_ID" ]; then
  echo "PASS ($SESSION_ID)"
else
  echo "FAIL"
  echo "$SESSION_BODY"
  exit 1
fi

create_node() {
  local name="$1"
  curl -s \
    -X POST "$BASE_URL/api/sessions/$SESSION_ID/nodes" \
    -H "Content-Type: application/json" \
    -b "$COOKIE_JAR" \
    -d "{\"agentType\":\"custom\",\"name\":\"$name\",\"model\":\"openai/gpt-5\"}"
}

echo -n "3. Create source and target threads... "
SOURCE_ID="$(create_node "Source Thread" | json_field "id")"
TARGET_ID="$(create_node "Target Thread" | json_field "id")"
if [ -n "$SOURCE_ID" ] && [ -n "$TARGET_ID" ]; then
  echo "PASS"
else
  echo "FAIL"
  exit 1
fi

echo -n "4. Send README.md from source to target... "
TRANSFER_ONE_HTTP="$(curl -s -o /tmp/filepath-transfer-1.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/sessions/$SESSION_ID/artifacts" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d "{\"sourceNodeId\":\"$SOURCE_ID\",\"sourcePath\":\"README.md\",\"targetNodeId\":\"$TARGET_ID\",\"targetPath\":\"handoffs/README.md\"}")"
if [ "$TRANSFER_ONE_HTTP" = "201" ]; then
  echo "PASS"
else
  echo "FAIL (HTTP $TRANSFER_ONE_HTTP)"
  cat /tmp/filepath-transfer-1.json
  exit 1
fi

echo -n "5. Round-trip the handed-off file back from target... "
TRANSFER_TWO_HTTP="$(curl -s -o /tmp/filepath-transfer-2.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/sessions/$SESSION_ID/artifacts" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d "{\"sourceNodeId\":\"$TARGET_ID\",\"sourcePath\":\"handoffs/README.md\",\"targetNodeId\":\"$SOURCE_ID\",\"targetPath\":\"roundtrip/README.md\"}")"
if [ "$TRANSFER_TWO_HTTP" = "201" ]; then
  echo "PASS"
else
  echo "FAIL (HTTP $TRANSFER_TWO_HTTP)"
  cat /tmp/filepath-transfer-2.json
  exit 1
fi

echo -n "6. Artifact history records delivered transfers... "
ARTIFACTS_BODY="$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/sessions/$SESSION_ID/artifacts")"
DELIVERED_COUNT="$(printf '%s' "$ARTIFACTS_BODY" | python3 -c '
import json, sys
data = json.load(sys.stdin)
count = 0
for item in data.get("artifacts", []):
    if item.get("status") == "delivered":
        count += 1
print(count)
')"
if [ "${DELIVERED_COUNT:-0}" -ge 2 ]; then
  echo "PASS ($DELIVERED_COUNT delivered)"
else
  echo "FAIL"
  echo "$ARTIFACTS_BODY"
  exit 1
fi

echo "✅ Cross-thread file handoff gate passed"
