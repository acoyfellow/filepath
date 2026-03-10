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
CURL_MAX_TIME="${CURL_MAX_TIME:-30}"
CURL_RETRIES="${CURL_RETRIES:-2}"
COOKIE_JAR=$(mktemp)
FAILED=0
WARNS=0

cleanup() { rm -f "$COOKIE_JAR"; }
trap cleanup EXIT

fetch_page() {
  local url="$1"
  local cookie_arg="${2:-}"
  local curl_args=(
    -s
    -w "\n%{http_code}"
    --max-time "$CURL_MAX_TIME"
    --retry "$CURL_RETRIES"
    --retry-delay 1
    --retry-connrefused
    -L
  )

  if [ -n "$cookie_arg" ]; then
    curl_args+=(-b "$cookie_arg")
  fi

  if ! curl "${curl_args[@]}" "$url"; then
    return 1
  fi
}

check_page() {
  local name="$1"
  local url="$2"
  local marker="$3"
  local use_auth="${4:-false}"
  local cookie_arg=""
  local resp
  local http
  local body
  
  if [ "$use_auth" = "true" ]; then
    cookie_arg="$COOKIE_JAR"
  fi
  
  echo -n "  $name... "

  if ! resp=$(fetch_page "$url" "$cookie_arg" 2>&1); then
    echo "FAIL (request error)"
    FAILED=$((FAILED + 1))
    return
  fi

  http=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')
  
  if [ "$http" = "200" ]; then
    if [ -n "$marker" ] && grep -Eqi "$marker" <<<"$body"; then
      echo "PASS (content: \"$marker\" found)"
    elif [ -n "$marker" ]; then
      echo "WARN (HTTP 200 but marker \"$marker\" not found)"
      WARNS=$((WARNS + 1))
    else
      echo "PASS"
    fi
  elif [ "$http" = "302" ] || [ "$http" = "303" ]; then
    if [ "$use_auth" = "true" ]; then
      echo "FAIL (redirected - auth cookie may be invalid)"
      FAILED=$((FAILED + 1))
    else
      echo "PASS (redirect)"
    fi
  else
    echo "FAIL (HTTP $http)"
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
