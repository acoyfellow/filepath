#!/bin/bash
# Gate: failed file handoff is explicit and non-silent against a live stack

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

echo "=== File Handoff Failure Gate ==="
echo "Target: $BASE_URL"

echo -n "1. Login... "
LOGIN_HTTP="$(curl -s -o /tmp/filepath-login-fail.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
  -c "$COOKIE_JAR")"
if [ "$LOGIN_HTTP" = "200" ]; then
  echo "PASS"
else
  echo "FAIL (HTTP $LOGIN_HTTP)"
  cat /tmp/filepath-login-fail.json
  echo "Use TEST_EMAIL/TEST_PASSWORD for an existing test account."
  exit 1
fi

SESSION_ID="$(curl -s \
  -X POST "$BASE_URL/api/sessions" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d '{"name":"Truth Handoff Failure"}' | json_field "id")"

SOURCE_ID="$(curl -s \
  -X POST "$BASE_URL/api/sessions/$SESSION_ID/nodes" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d '{"agentType":"custom","name":"Source Thread","model":"openai/gpt-5"}' | json_field "id")"
TARGET_ID="$(curl -s \
  -X POST "$BASE_URL/api/sessions/$SESSION_ID/nodes" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d '{"agentType":"custom","name":"Target Thread","model":"openai/gpt-5"}' | json_field "id")"

if [ -z "$SESSION_ID" ] || [ -z "$SOURCE_ID" ] || [ -z "$TARGET_ID" ]; then
  echo "FAIL (session or thread creation failed)"
  exit 1
fi

echo -n "2. Invalid source path fails explicitly... "
FAIL_HTTP="$(curl -s -o /tmp/filepath-transfer-fail.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/sessions/$SESSION_ID/artifacts" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d "{\"sourceNodeId\":\"$SOURCE_ID\",\"sourcePath\":\"ghost/should-not-exist.txt\",\"targetNodeId\":\"$TARGET_ID\",\"targetPath\":\"handoffs/should-not-exist.txt\"}")"
if [ "$FAIL_HTTP" = "500" ]; then
  echo "PASS"
else
  echo "FAIL (HTTP $FAIL_HTTP)"
  cat /tmp/filepath-transfer-fail.json
  exit 1
fi

echo -n "3. Artifact history records failed status... "
ARTIFACTS_BODY="$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/sessions/$SESSION_ID/artifacts")"
FAILED_COUNT="$(printf '%s' "$ARTIFACTS_BODY" | python3 -c '
import json, sys
data = json.load(sys.stdin)
count = 0
for item in data.get("artifacts", []):
    if item.get("status") == "failed":
        count += 1
print(count)
')"
if [ "${FAILED_COUNT:-0}" -ge 1 ]; then
  echo "PASS"
else
  echo "FAIL"
  echo "$ARTIFACTS_BODY"
  exit 1
fi

echo -n "4. Failed transfer did not leave a target file behind... "
ROUNDTRIP_HTTP="$(curl -s -o /tmp/filepath-transfer-fail-roundtrip.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/sessions/$SESSION_ID/artifacts" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d "{\"sourceNodeId\":\"$TARGET_ID\",\"sourcePath\":\"handoffs/should-not-exist.txt\",\"targetNodeId\":\"$SOURCE_ID\",\"targetPath\":\"roundtrip/should-not-exist.txt\"}")"
if [ "$ROUNDTRIP_HTTP" = "500" ]; then
  echo "PASS"
else
  echo "FAIL (HTTP $ROUNDTRIP_HTTP)"
  cat /tmp/filepath-transfer-fail-roundtrip.json
  exit 1
fi

echo "✅ File handoff failure gate passed"
