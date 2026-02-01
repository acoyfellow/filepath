#!/bin/bash
# Gate test: Login flow - CRITICAL: Login must never return 405
BASE_URL="${1:-https://myfilepath.com}"
FAILED=0

echo "=== LOGIN GATE TEST ==="
echo "Target: $BASE_URL"
echo ""

# Test 1: Login page loads (GET)
echo -n "1. Login page loads (GET /login)... "
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/login")
[ "$HTTP" = "200" ] && echo "✅" || { echo "❌ HTTP $HTTP"; FAILED=1; }

# Test 2: Login page does NOT return 405 for GET
echo -n "2. Login page not 405 on GET... "
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/login")
[ "$HTTP" != "405" ] && echo "✅" || { echo "❌ CRITICAL: Login returns 405 on GET"; FAILED=1; }

# Test 3: Login API endpoint exists (POST to /api/auth/sign-in/email)
echo -n "3. Sign-in API endpoint exists... "
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$BASE_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d '{}')
# 400 = bad request (expected, no valid data), 401 = unauthorized, 200 = success
# 405 = method not allowed (CRITICAL FAILURE)
if [ "$HTTP" = "405" ]; then
  echo "❌ CRITICAL: Sign-in API returns 405 (Method Not Allowed)"
  FAILED=1
elif [ "$HTTP" = "400" ] || [ "$HTTP" = "401" ] || [ "$HTTP" = "200" ] || [ "$HTTP" = "422" ]; then
  echo "✅ (HTTP $HTTP - expected for empty body)"
else
  echo "⚠️ HTTP $HTTP (unexpected but not 405)"
fi

# Test 4: Better-auth session endpoint works
echo -n "4. Auth session endpoint... "
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/api/auth/get-session")
[ "$HTTP" = "200" ] || [ "$HTTP" = "401" ] && echo "✅" || { echo "❌ HTTP $HTTP"; FAILED=1; }

# Test 5: Verify login page has working form (check for client-side JS handler)
echo -n "5. Login page has auth client... "
RESP=$(curl -s --max-time 10 "$BASE_URL/login")
echo "$RESP" | grep -q "signIn" && echo "✅" || { echo "❌ Login page missing signIn handler"; FAILED=1; }

echo ""
[ $FAILED -eq 0 ] && echo "✅ Login gates passed" || echo "❌ $FAILED login gates FAILED - BLOCKING PUSH"
exit $FAILED
