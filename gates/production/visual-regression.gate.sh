#!/bin/bash
# Production Gate: Visual Regression
# Verifies key pages return 200 and contain expected content markers
# This is a lightweight "smoke test" for visual regressions
#
# Tests:
# - Landing page renders with key content
# - Login page has form elements
# - Signup page has form elements
# - Dashboard (auth'd) has session content
# - Settings pages load correctly
# - Docs/Pricing pages render
#
# Usage: ./gates/production/visual-regression.gate.sh [base_url]

set -euo pipefail

BASE_URL="${1:-https://myfilepath.com}"
TEST_EMAIL="${TEST_EMAIL:-test-e2e-1770332875@example.com}"
TEST_PASSWORD="${TEST_PASSWORD:-TestPass123!}"
COOKIE_JAR=$(mktemp)
FAILED=0
WARNS=0

cleanup() { rm -f "$COOKIE_JAR"; }
trap cleanup EXIT

check_page() {
  local name="$1"
  local url="$2"
  local marker="$3"
  local use_auth="${4:-false}"
  local cookie_arg=""
  
  if [ "$use_auth" = "true" ]; then
    cookie_arg="-b $COOKIE_JAR"
  fi
  
  echo -n "  $name... "
  RESP=$(curl -s -w "\n%{http_code}" $cookie_arg "$url" --max-time 15 -L 2>&1)
  HTTP=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | sed '$d')
  
  if [ "$HTTP" = "200" ]; then
    if [ -n "$marker" ] && echo "$BODY" | grep -qi "$marker"; then
      echo "PASS (content: \"$marker\" found)"
    elif [ -n "$marker" ]; then
      echo "WARN (HTTP 200 but marker \"$marker\" not found)"
      WARNS=$((WARNS + 1))
    else
      echo "PASS"
    fi
  elif [ "$HTTP" = "302" ] || [ "$HTTP" = "303" ]; then
    if [ "$use_auth" = "true" ]; then
      echo "FAIL (redirected - auth cookie may be invalid)"
      FAILED=$((FAILED + 1))
    else
      echo "PASS (redirect)"
    fi
  else
    echo "FAIL (HTTP $HTTP)"
    FAILED=$((FAILED + 1))
  fi
}

echo "=== PRODUCTION GATE: VISUAL REGRESSION ==="
echo "Target: $BASE_URL"
echo ""

# Public pages (no auth required)
echo "Public Pages:"
check_page "Landing page" "$BASE_URL/" "myfilepath"
check_page "Login page" "$BASE_URL/login" "sign in\|login\|email\|password"
check_page "Signup page" "$BASE_URL/signup" "sign up\|create\|register"
check_page "Docs page" "$BASE_URL/docs" "api\|documentation\|getting started"
check_page "Pricing page" "$BASE_URL/pricing" "credit\|pricing\|plan"

echo ""

# Login for authenticated pages
echo -n "Authenticating... "
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
  -c "$COOKIE_JAR" --max-time 15 2>&1)
LOGIN_HTTP=$(echo "$LOGIN_RESP" | tail -1)
if [ "$LOGIN_HTTP" = "200" ]; then
  echo "OK"
else
  echo "FAIL (HTTP $LOGIN_HTTP) - skipping auth pages"
  FAILED=$((FAILED + 1))
  echo ""
  echo "Results: $FAILED failures, $WARNS warnings"
  exit 1
fi

echo ""
echo "Authenticated Pages:"
check_page "Dashboard" "$BASE_URL/dashboard" "session" "true"
check_page "Billing settings" "$BASE_URL/settings/billing" "credit\|billing\|balance" "true"
check_page "API keys settings" "$BASE_URL/settings/api-keys" "api.*key\|create" "true"
check_page "Account settings" "$BASE_URL/settings/account" "account\|delete\|profile" "true"

echo ""
echo "Summary: $FAILED failures, $WARNS warnings"
if [ $FAILED -eq 0 ]; then
  echo "✅ VISUAL REGRESSION GATE: PASSED"
  exit 0
else
  echo "❌ VISUAL REGRESSION GATE: FAILED"
  exit 1
fi
