#!/bin/bash
# Gate test: Email/password reset functionality
BASE_URL="${1:-https://myfilepath.com}"
FAILED=0

echo "=== EMAIL RESET GATE TEST ==="
echo "Target: $BASE_URL"
echo ""

# Test 1: Forgot password endpoint exists
echo -n "1. Forgot password endpoint... "
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$BASE_URL/api/auth/forget-password/email-otp" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}')
# 400 = bad request (expected, no session), 500 = server error
[ "$HTTP" = "400" ] || [ "$HTTP" = "200" ] && echo "✅" || { echo "❌ HTTP $HTTP"; FAILED=1; }

# Test 2: Request password reset endpoint exists
echo -n "2. Request password reset endpoint... "
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$BASE_URL/api/auth/email-otp/request-password-reset" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}')
# 400 = bad request (expected, no session), 500 = server error
[ "$HTTP" = "400" ] || [ "$HTTP" = "200" ] && echo "✅" || { echo "❌ HTTP $HTTP"; FAILED=1; }

# Test 3: Reset password endpoint exists
echo -n "3. Reset password endpoint... "
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$BASE_URL/api/auth/email-otp/reset-password" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","otp":"123456","password":"newpassword"}')
# 400 = bad request (expected, invalid data), 500 = server error
[ "$HTTP" = "400" ] || [ "$HTTP" = "200" ] && echo "✅" || { echo "❌ HTTP $HTTP"; FAILED=1; }

# Test 4: Environment variables for Mailgun are set
echo -n "4. Mailgun environment variables... "
if [ -f ".env" ]; then
  MAILGUN_API_KEY=$(grep MAILGUN_API_KEY .env | cut -d'=' -f2)
  MAILGUN_DOMAIN=$(grep MAILGUN_DOMAIN .env | cut -d'=' -f2)
  if [ -n "$MAILGUN_API_KEY" ] && [ -n "$MAILGUN_DOMAIN" ]; then
    echo "✅"
  else
    echo "❌ Not set in .env"
    FAILED=1
  fi
else
  echo "⚠️ .env file not found"
fi

echo ""
[ $FAILED -eq 0 ] && echo "✅ Email reset gates passed" || echo "❌ $FAILED email reset gates failed"
exit $FAILED
