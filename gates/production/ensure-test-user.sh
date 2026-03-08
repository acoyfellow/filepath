#!/bin/bash
# Ensure test user exists in production DB
# Tries to login; if 401, creates the user via sign-up, then retries login.
# Idempotent — safe to run multiple times.
#
# Usage: ./gates/production/ensure-test-user.sh [base_url]
# Env: TEST_EMAIL, TEST_PASSWORD, TEST_OPENROUTER_KEY

set -euo pipefail

BASE_URL="${1:-${BASE_URL:-https://myfilepath.com}}"
TEST_EMAIL="${TEST_EMAIL:-test-e2e-1770332875@example.com}"
TEST_PASSWORD="${TEST_PASSWORD:-TestPass123!}"
TEST_NAME="${TEST_NAME:-Gate Test User}"
TEST_OPENROUTER_KEY="${TEST_OPENROUTER_KEY:-}"
COOKIE_JAR=$(mktemp)

cleanup() {
  rm -f "$COOKIE_JAR"
}
trap cleanup EXIT

echo "=== ENSURE TEST USER ==="
echo "Target: $BASE_URL"
echo "Email:  $TEST_EMAIL"
echo ""

if [ -z "$TEST_OPENROUTER_KEY" ]; then
  echo "❌ TEST_OPENROUTER_KEY not set"
  exit 1
fi

# --- Step 1: Try to login ---
echo -n "1. Attempting login... "
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
  -c "$COOKIE_JAR" \
  --max-time 15 2>&1)
LOGIN_HTTP=$(echo "$LOGIN_RESP" | tail -1)

if [ "$LOGIN_HTTP" = "200" ]; then
  echo "OK (user exists, login succeeded)"
else
  echo "HTTP $LOGIN_HTTP (user may not exist)"

  # --- Step 2: Try to sign up ---
  echo -n "2. Signing up test user... "
  SIGNUP_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/sign-up/email" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"name\":\"$TEST_NAME\"}" \
    --max-time 15 2>&1)
  SIGNUP_HTTP=$(echo "$SIGNUP_RESP" | tail -1)
  SIGNUP_BODY=$(echo "$SIGNUP_RESP" | sed '$d')

  if [ "$SIGNUP_HTTP" = "200" ] || [ "$SIGNUP_HTTP" = "201" ]; then
    echo "OK (user created)"
  elif echo "$SIGNUP_BODY" | grep -qi "already exists\|duplicate\|existing\|USER_ALREADY_EXISTS"; then
    echo "OK (user already exists)"
  else
    echo "WARN (HTTP $SIGNUP_HTTP)"
    echo "  Body: $(echo "$SIGNUP_BODY" | head -c 300)"
  fi

  # --- Step 3: Retry login ---
  echo -n "3. Retrying login... "
  RETRY_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/sign-in/email" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
    -c "$COOKIE_JAR" \
    --max-time 15 2>&1)
  RETRY_HTTP=$(echo "$RETRY_RESP" | tail -1)

  if [ "$RETRY_HTTP" = "200" ]; then
    echo "OK"
  else
    RETRY_BODY=$(echo "$RETRY_RESP" | sed '$d')
    echo "FAIL (HTTP $RETRY_HTTP)"
    echo ""
    echo "❌ Could not authenticate test user after sign-up attempt"
    echo "   Email: $TEST_EMAIL"
    echo "   Response: $(echo "$RETRY_BODY" | head -c 300)"
    echo ""
    echo "Possible causes:"
    echo "  - Auth service is down (HTTP 503)"
    echo "  - BETTER_AUTH_SECRET mismatch between deploys"
    echo "  - D1 database binding issue"
    echo "  - Email verification required (should be disabled)"
    exit 1
  fi
fi

# --- Step 4: Save account-level OpenRouter key ---
echo -n "4. Saving account-level router key... "
KEY_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/user/keys" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d "{\"provider\":\"openrouter\",\"key\":\"$TEST_OPENROUTER_KEY\"}" \
  --max-time 15 2>&1)
KEY_HTTP=$(echo "$KEY_RESP" | tail -1)
KEY_BODY=$(echo "$KEY_RESP" | sed '$d')
if [ "$KEY_HTTP" = "200" ] || [ "$KEY_HTTP" = "201" ]; then
  echo "OK"
else
  echo "FAIL (HTTP $KEY_HTTP)"
  echo "  Response: $(echo "$KEY_BODY" | head -c 300)"
  echo "❌ Could not validate or save TEST_OPENROUTER_KEY through /api/user/keys"
  exit 1
fi

# --- Step 5: Verify masked key exists ---
echo -n "5. Verifying masked router key... "
VERIFY_RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/user/keys" \
  -b "$COOKIE_JAR" \
  --max-time 15 2>&1)
VERIFY_HTTP=$(echo "$VERIFY_RESP" | tail -1)
VERIFY_BODY=$(echo "$VERIFY_RESP" | sed '$d')
HAS_OPENROUTER=$(echo "$VERIFY_BODY" | python3 -c "import json,sys; print('yes' if (json.load(sys.stdin).get('keys',{}).get('openrouter')) else 'no')" 2>/dev/null || echo "no")
if [ "$VERIFY_HTTP" = "200" ] && [ "$HAS_OPENROUTER" = "yes" ]; then
  echo "OK"
  echo "✅ Test user ready"
  exit 0
fi

echo "FAIL (HTTP $VERIFY_HTTP)"
echo "  Response: $(echo "$VERIFY_BODY" | head -c 300)"
echo "❌ Router key save did not produce a masked account key"
exit 1
