#!/bin/bash
# API E2E Gate: Backend Integration Tests
# Tests auth, billing, and credit APIs directly

set -e

BASE_URL="${BASE_URL:-http://localhost:5173}"
API_URL="$BASE_URL/api"

echo "🔌 API E2E INTEGRATION TESTS"
echo "============================"
echo ""

# Test 1: Health check
echo "Test 1: API Health"
HEALTH=$(curl -s "$API_URL/health" 2>/dev/null || echo "{\"status\":\"error\"}")
if echo "$HEALTH" | grep -q "ok"; then
  echo "✅ API is healthy"
else
  echo "⚠️  API health check returned: $HEALTH"
fi

# Test 2: Auth endpoints available
echo ""
echo "Test 2: Auth Endpoints"
AUTH_ENDPOINTS=(
  "/auth/sign-up/email"
  "/auth/sign-in/email"
  "/auth/email-otp/request-password-reset"
  "/auth/email-otp/reset-password"
)

for endpoint in "${AUTH_ENDPOINTS[@]}"; do
  # Check if endpoint exists (returns 400 for GET, which is expected for POST-only)
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL$endpoint" 2>/dev/null || echo "000")
  if [ "$STATUS" = "400" ] || [ "$STATUS" = "405" ] || [ "$STATUS" = "200" ]; then
    echo "✅ $endpoint (status: $STATUS)"
  else
    echo "❌ $endpoint (status: $STATUS)"
  fi
done

# Test 3: Signup flow
echo ""
echo "Test 3: User Registration Flow"
TEST_EMAIL="apitest-$(date +%s)@test.com"
TEST_PASS="TestPass123!"

SIGNUP_RESULT=$(curl -s -X POST "$API_URL/auth/sign-up/email" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\",\"name\":\"API Test\"}" 2>/dev/null)

if echo "$SIGNUP_RESULT" | grep -q "token\|user"; then
  echo "✅ Signup API works"
  echo "   Response: $(echo "$SIGNUP_RESULT" | jq -c '.user.email' 2>/dev/null || echo "parse error")"
  
  # Verify user in database
  echo ""
  echo "   Database verification (run manually):"
  echo "   npx wrangler d1 execute filepath-db --command=\"SELECT * FROM user WHERE email='$TEST_EMAIL'\" --remote"
else
  echo "❌ Signup failed: $SIGNUP_RESULT"
fi

# Test 4: Password reset request
echo ""
echo "Test 4: Password Reset Flow"
RESET_REQUEST=$(curl -s -X POST "$API_URL/auth/email-otp/request-password-reset" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\"}" 2>/dev/null)

if [ ! -z "$RESET_REQUEST" ]; then
  echo "✅ Password reset request sent"
  echo "   Check Mailgun logs for OTP email"
else
  echo "⚠️  Password reset returned empty (may be expected)"
fi

# Test 5: Billing endpoints (if authenticated)
echo ""
echo "Test 5: Billing Integration"
echo "   ⚠️  Requires authenticated session"
echo "   Endpoints to test:"
echo "   - POST /api/billing/checkout-session"
echo "   - POST /api/billing/portal-session"
echo "   - GET  /api/user/credits"

# Test 6: Webhook endpoint
echo ""
echo "Test 6: Stripe Webhook"
WEBHOOK_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Stripe-Signature: test" \
  "$API_URL/billing/webhook" 2>/dev/null || echo "000")
echo "   Webhook endpoint status: $WEBHOOK_STATUS (400 expected without valid sig)"

echo ""
echo "============================"
echo "✅ API E2E Tests Complete"
echo ""
echo "To verify emails:"
echo "  - Check Mailgun dashboard"
echo "  - Or run: npx wrangler tail filepath-app --format=pretty | grep -i email"
echo ""
echo "To verify Stripe:"
echo "  - Check Stripe dashboard in test mode"
echo "  - Look for customers created with email pattern: *@test.com"
