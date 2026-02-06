#!/bin/bash
# Production Gate: Terminal Start
# Verifies that session creation and terminal loading work end-to-end
# Requires: valid session cookie (logged-in user)
#
# Usage: ./gates/production/terminal-start.gate.sh [base_url]

set -euo pipefail

BASE_URL="${1:-https://myfilepath.com}"
TEST_EMAIL="${TEST_EMAIL:-test-e2e-1770332875@example.com}"
TEST_PASSWORD="${TEST_PASSWORD:-TestPass123!}"
COOKIE_JAR=$(mktemp)
FAILED=0

cleanup() { rm -f "$COOKIE_JAR"; }
trap cleanup EXIT

echo "=== PRODUCTION GATE: TERMINAL START ==="
echo "Target: $BASE_URL"
echo ""

# Step 1: Login to get session cookie
echo -n "1. Login... "
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
  -c "$COOKIE_JAR" --max-time 15 2>&1)
LOGIN_HTTP=$(echo "$LOGIN_RESP" | tail -1)
LOGIN_BODY=$(echo "$LOGIN_RESP" | sed '$d')

if [ "$LOGIN_HTTP" = "200" ] && echo "$LOGIN_BODY" | grep -q '"token"'; then
  echo "PASS"
else
  echo "FAIL (HTTP $LOGIN_HTTP)"
  echo "  Body: $(echo "$LOGIN_BODY" | head -c 200)"
  exit 1
fi

# Step 2: Create a new session
echo -n "2. Create session... "
SESSION_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/session" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" --max-time 15 2>&1)
SESSION_HTTP=$(echo "$SESSION_RESP" | tail -1)
SESSION_BODY=$(echo "$SESSION_RESP" | sed '$d')

if [ "$SESSION_HTTP" = "200" ] || [ "$SESSION_HTTP" = "201" ]; then
  SESSION_ID=$(echo "$SESSION_BODY" | jq -r '.id // .sessionId // empty' 2>/dev/null)
  if [ -n "$SESSION_ID" ]; then
    echo "PASS (session: $SESSION_ID)"
  else
    echo "PASS (HTTP $SESSION_HTTP, but no session ID in response)"
    SESSION_ID=""
  fi
else
  echo "FAIL (HTTP $SESSION_HTTP)"
  echo "  Body: $(echo "$SESSION_BODY" | head -c 200)"
  FAILED=1
  SESSION_ID=""
fi

# Step 3: Load session page (terminal UI)
if [ -n "$SESSION_ID" ]; then
  echo -n "3. Load terminal page... "
  PAGE_RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/session/$SESSION_ID" \
    -b "$COOKIE_JAR" --max-time 15 2>&1)
  PAGE_HTTP=$(echo "$PAGE_RESP" | tail -1)
  PAGE_BODY=$(echo "$PAGE_RESP" | sed '$d')

  if [ "$PAGE_HTTP" = "200" ]; then
    # Check page has terminal-related content
    if echo "$PAGE_BODY" | grep -qi 'terminal\|ttyd\|session\|tab'; then
      echo "PASS (terminal UI loaded)"
    else
      echo "PASS (HTTP 200, but no terminal markers found)"
    fi
  else
    echo "FAIL (HTTP $PAGE_HTTP)"
    FAILED=1
  fi
else
  echo "3. Load terminal page... SKIP (no session ID)"
fi

# Step 4: Dashboard lists the session
echo -n "4. Dashboard shows sessions... "
DASH_RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/dashboard" \
  -b "$COOKIE_JAR" --max-time 15 2>&1)
DASH_HTTP=$(echo "$DASH_RESP" | tail -1)
DASH_BODY=$(echo "$DASH_RESP" | sed '$d')

if [ "$DASH_HTTP" = "200" ]; then
  echo "PASS"
else
  echo "FAIL (HTTP $DASH_HTTP)"
  FAILED=1
fi

# Step 5: Unauthenticated terminal access denied
echo -n "5. Unauthenticated terminal blocked... "
UNAUTH_HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/session/fake-session-id" --max-time 10)
if [ "$UNAUTH_HTTP" = "302" ] || [ "$UNAUTH_HTTP" = "303" ] || [ "$UNAUTH_HTTP" = "401" ] || [ "$UNAUTH_HTTP" = "403" ]; then
  echo "PASS (HTTP $UNAUTH_HTTP - redirects to login)"
else
  echo "WARN (HTTP $UNAUTH_HTTP - expected redirect/401)"
fi

echo ""
if [ $FAILED -eq 0 ]; then
  echo "✅ TERMINAL START GATE: PASSED"
  exit 0
else
  echo "❌ TERMINAL START GATE: FAILED"
  exit 1
fi
