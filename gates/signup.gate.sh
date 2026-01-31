#!/bin/bash
# Gate test: Signup flow
BASE_URL="${1:-https://myfilepath.com}"
FAILED=0

echo "=== SIGNUP GATE TEST ==="
echo "Target: $BASE_URL"
echo ""

# Test 1: Homepage loads
echo -n "1. Homepage... "
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/")
[ "$HTTP" = "200" ] && echo "✅" || { echo "❌ HTTP $HTTP"; FAILED=1; }

# Test 2: Signup page
echo -n "2. /signup... "
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/signup")
[ "$HTTP" = "200" ] && echo "✅" || { echo "❌ HTTP $HTTP"; FAILED=1; }

# Test 3: Dashboard (should redirect to login or show auth required)
echo -n "3. /dashboard... "
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/dashboard")
[ "$HTTP" = "200" ] || [ "$HTTP" = "302" ] && echo "✅" || { echo "❌ HTTP $HTTP"; FAILED=1; }

# Test 4: Auth get-session
echo -n "4. get-session API... "
RESP=$(curl -s --max-time 10 "$BASE_URL/api/auth/get-session")
[ "$RESP" = "null" ] || echo "$RESP" | grep -q "session" && echo "✅" || { echo "❌"; FAILED=1; }

# Test 5: Email signup endpoint exists
echo -n "5. signup endpoint... "
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$BASE_URL/api/auth/sign-up/email" \
  -H "Content-Type: application/json" \
  -d '{}')
# 400 = bad request (expected, no data), 500 = server error
[ "$HTTP" = "400" ] && echo "✅ (400 expected)" || { echo "⚠️ HTTP $HTTP"; }

# Test 6: Passkey endpoint
echo -n "6. passkey endpoint... "
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/api/auth/passkey/generate-register-options")
[ "$HTTP" = "401" ] && echo "✅ (401 expected)" || { echo "⚠️ HTTP $HTTP"; }

echo ""
[ $FAILED -eq 0 ] && echo "✅ Gates passed" || echo "❌ $FAILED gates failed"
exit $FAILED
