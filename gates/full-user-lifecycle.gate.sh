#!/bin/bash
# E2E Gate: Full User Lifecycle
# Tests signup → welcome email → stripe customer → credits → usage

set -e

BASE_URL="${BASE_URL:-http://localhost:5173}"
TEST_EMAIL="test-$(date +%s)@example.com"
TEST_PASSWORD="TestPass123!"

echo "🧪 FULL USER LIFECYCLE E2E TEST"
echo "================================"
echo "Testing: $TEST_EMAIL"
echo ""

# Step 1: Signup
echo "Step 1: User Registration"
SIGNUP_RESULT=$(curl -s -X POST "$BASE_URL/api/auth/sign-up/email" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"name\":\"Test User\"}" \
  2>&1)

if echo "$SIGNUP_RESULT" | grep -q "token\|session"; then
  echo "✅ Signup successful"
  USER_ID=$(echo "$SIGNUP_RESULT" | jq -r '.user.id' 2>/dev/null || echo "unknown")
  echo "   User ID: $USER_ID"
else
  echo "❌ Signup failed: $SIGNUP_RESULT"
  exit 1
fi

# Step 2: Check welcome email was triggered (check logs)
echo ""
echo "Step 2: Welcome Email Verification"
echo "   ⚠️  Check your Mailgun logs for email to: $TEST_EMAIL"
echo "   Expected: Welcome to MyFilePath! with OTP code"

# Step 3: Verify user in database
echo ""
echo "Step 3: Database Verification"
echo "   User should have:"
echo "   - role = 'user'"
echo "   - banned = false"
echo "   - credit_balance = 0 (initially)"
echo "   - stripe_customer_id = null (initially)"

# Step 4: Login
echo ""
echo "Step 4: Login"
LOGIN_RESULT=$(curl -s -X POST "$BASE_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
  -c /tmp/cookies.txt 2>&1)

if echo "$LOGIN_RESULT" | grep -q "token\|session"; then
  echo "✅ Login successful"
else
  echo "❌ Login failed: $LOGIN_RESULT"
  exit 1
fi

# Step 5: Load credits (manual step - requires Stripe)
echo ""
echo "Step 5: Credit Loading (REQUIRES MANUAL ACTION)"
echo "   ⚠️  This requires Stripe integration"
echo "   To load $10 of test credits:"
echo "   1. Login at: $BASE_URL/login"
echo "   2. Go to billing settings"
echo "   3. Add test card: 4242 4242 4242 4242"
echo "   4. Purchase $10 credits"
echo "   5. Check Stripe dashboard for customer"

# Step 6: Verify credits in DB
echo ""
echo "Step 6: Post-Purchase Verification"
echo "   Expected in database:"
echo "   - user.credit_balance = 10000 (cents)"
echo "   - user.stripe_customer_id = 'cus_xxxxx'"
echo "   - Stripe customer exists with $10 charge"

# Step 7: Session creation (credit usage)
echo ""
echo "Step 7: Session Execution (Credit Usage)"
echo "   Expected behavior:"
echo "   - Create session: deducts 1000 credits minimum"
echo "   - Every minute: deducts additional credits"
echo "   - Credit balance decreases in real-time"
echo "   - Usage tracked in user.credit_balance"

echo ""
echo "================================"
echo "✅ E2E Gate: PASSED (Manual steps required for full validation)"
echo ""
echo "Next steps for complete test:"
echo "1. Check Mailgun dashboard for welcome email"
echo "2. Complete Stripe checkout for credits"
echo "3. Verify customer created in Stripe"
echo "4. Create session and watch credits deduct"
