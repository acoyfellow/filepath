#!/bin/bash
# Ensure test user exists in production DB
# Tries to login; if 401, creates the user via sign-up, then retries login.
# Idempotent — safe to run multiple times.
#
# Usage: ./gates/production/ensure-test-user.sh [base_url]
# Env: TEST_EMAIL, TEST_PASSWORD

set -euo pipefail

BASE_URL="${1:-${BASE_URL:-https://myfilepath.com}}"
TEST_EMAIL="${TEST_EMAIL:-test-e2e-1770332875@example.com}"
TEST_PASSWORD="${TEST_PASSWORD:-TestPass123!}"
TEST_NAME="${TEST_NAME:-Gate Test User}"

echo "=== ENSURE TEST USER ==="
echo "Target: $BASE_URL"
echo "Email:  $TEST_EMAIL"
echo ""

# --- Step 1: Try to login ---
echo -n "1. Attempting login... "
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
  --max-time 15 2>&1)
LOGIN_HTTP=$(echo "$LOGIN_RESP" | tail -1)

if [ "$LOGIN_HTTP" = "200" ]; then
  echo "OK (user exists, login succeeded)"
  echo "✅ Test user ready"
  exit 0
fi

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
  # Don't exit yet — the login retry below will be the real test
fi

# --- Step 3: Retry login ---
echo -n "3. Retrying login... "
RETRY_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
  --max-time 15 2>&1)
RETRY_HTTP=$(echo "$RETRY_RESP" | tail -1)

if [ "$RETRY_HTTP" = "200" ]; then
  echo "OK"
  echo "✅ Test user ready"
  exit 0
fi

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
