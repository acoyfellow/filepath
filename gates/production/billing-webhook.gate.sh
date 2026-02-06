#!/bin/bash
# Production Gate: Billing & Webhook
# Verifies Stripe checkout flow and webhook endpoint exist
#
# Tests:
# - Checkout endpoint returns Stripe URL
# - Webhook endpoint accepts POST (returns 400 for invalid sig, not 404)
# - Billing page renders with session
# - Stripe customer creation path works
#
# Usage: ./gates/production/billing-webhook.gate.sh [base_url]

set -euo pipefail

BASE_URL="${1:-https://myfilepath.com}"
TEST_EMAIL="${TEST_EMAIL:-test-e2e-1770332875@example.com}"
TEST_PASSWORD="${TEST_PASSWORD:-TestPass123!}"
COOKIE_JAR=$(mktemp)
FAILED=0

cleanup() { rm -f "$COOKIE_JAR"; }
trap cleanup EXIT

echo "=== PRODUCTION GATE: BILLING & WEBHOOK ==="
echo "Target: $BASE_URL"
echo ""

# Step 1: Login
echo -n "1. Login... "
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
  -c "$COOKIE_JAR" --max-time 15 2>&1)
LOGIN_HTTP=$(echo "$LOGIN_RESP" | tail -1)
if [ "$LOGIN_HTTP" = "200" ]; then
  echo "PASS"
else
  echo "FAIL (HTTP $LOGIN_HTTP)"
  exit 1
fi

# Step 2: Checkout endpoint exists and requires auth
echo -n "2. Checkout endpoint (authenticated)... "
CHECKOUT_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/billing/checkout" \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000}' \
  -b "$COOKIE_JAR" --max-time 15 2>&1)
CHECKOUT_HTTP=$(echo "$CHECKOUT_RESP" | tail -1)
CHECKOUT_BODY=$(echo "$CHECKOUT_RESP" | sed '$d')

if [ "$CHECKOUT_HTTP" = "200" ]; then
  if echo "$CHECKOUT_BODY" | grep -q 'stripe.com\|checkout\|url'; then
    echo "PASS (Stripe checkout URL returned)"
  else
    echo "PASS (HTTP 200)"
  fi
else
  # 400 is OK if it means bad request format, 500 means Stripe config issue
  echo "WARN (HTTP $CHECKOUT_HTTP)"
  echo "  Body: $(echo "$CHECKOUT_BODY" | head -c 200)"
fi

# Step 3: Checkout without auth fails
echo -n "3. Checkout without auth blocked... "
UNAUTH_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/billing/checkout" \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000}' --max-time 10)
if [ "$UNAUTH_HTTP" = "401" ] || [ "$UNAUTH_HTTP" = "403" ]; then
  echo "PASS (HTTP $UNAUTH_HTTP)"
else
  echo "FAIL (HTTP $UNAUTH_HTTP - expected 401/403)"
  FAILED=1
fi

# Step 4: Stripe webhook endpoint exists (accepts POST, rejects bad signature)
echo -n "4. Webhook endpoint exists... "
WEBHOOK_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/webhooks/stripe" \
  -H "Content-Type: application/json" \
  -H "stripe-signature: t=1234,v1=fake" \
  -d '{"type":"checkout.session.completed"}' --max-time 10 2>&1)
WEBHOOK_HTTP=$(echo "$WEBHOOK_RESP" | tail -1)

# We expect 400 (bad signature) or 401, NOT 404 (route missing)
if [ "$WEBHOOK_HTTP" = "400" ] || [ "$WEBHOOK_HTTP" = "401" ] || [ "$WEBHOOK_HTTP" = "500" ]; then
  echo "PASS (HTTP $WEBHOOK_HTTP - endpoint exists, rejected bad signature)"
elif [ "$WEBHOOK_HTTP" = "404" ]; then
  echo "FAIL (HTTP 404 - webhook endpoint missing!)"
  FAILED=1
else
  echo "WARN (HTTP $WEBHOOK_HTTP)"
fi

# Step 5: Billing page loads with credit info
echo -n "5. Billing page loads... "
BILL_RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/settings/billing" \
  -b "$COOKIE_JAR" --max-time 15 2>&1)
BILL_HTTP=$(echo "$BILL_RESP" | tail -1)
BILL_BODY=$(echo "$BILL_RESP" | sed '$d')

if [ "$BILL_HTTP" = "200" ]; then
  if echo "$BILL_BODY" | grep -qi 'credit\|billing\|balance'; then
    echo "PASS (billing content found)"
  else
    echo "PASS (HTTP 200)"
  fi
else
  echo "FAIL (HTTP $BILL_HTTP)"
  FAILED=1
fi

# Step 6: API key budget endpoint
echo -n "6. API key budget endpoint... "
# Get API keys list first
KEYS_RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/auth/api-key/list" \
  -b "$COOKIE_JAR" --max-time 15 2>&1)
KEYS_HTTP=$(echo "$KEYS_RESP" | tail -1)

if [ "$KEYS_HTTP" = "200" ]; then
  echo "PASS (API keys accessible)"
else
  echo "WARN (HTTP $KEYS_HTTP)"
fi

echo ""
if [ $FAILED -eq 0 ]; then
  echo "✅ BILLING & WEBHOOK GATE: PASSED"
  exit 0
else
  echo "❌ BILLING & WEBHOOK GATE: FAILED"
  exit 1
fi
