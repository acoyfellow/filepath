#!/bin/bash
# Orchestrator Gate - tests agent task execution via API key
# Usage: ./gates/orchestrator.gate.sh [base_url]

set -e

BASE_URL="${1:-https://myfilepath.com}"
FAILED=0

echo "=== ORCHESTRATOR GATE TEST ==="
echo "Target: $BASE_URL"
echo ""

# Gate 1: Health check
echo -n "1. Health check... "
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/api/orchestrator")
[ "$HTTP" = "200" ] && echo "PASS" || { echo "FAIL HTTP $HTTP"; FAILED=1; }

# Gate 2: Missing API key returns 401
echo -n "2. Missing API key (401)... "
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$BASE_URL/api/orchestrator" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test","task":"echo hello"}')
[ "$HTTP" = "401" ] && echo "PASS" || { echo "FAIL HTTP $HTTP"; FAILED=1; }

# Gate 3: Invalid API key returns 401
echo -n "3. Invalid API key (401)... "
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$BASE_URL/api/orchestrator" \
  -H "Content-Type: application/json" \
  -H "x-api-key: invalid-key-12345" \
  -d '{"sessionId":"test","task":"echo hello"}')
[ "$HTTP" = "401" ] && echo "PASS" || { echo "FAIL HTTP $HTTP"; FAILED=1; }

# Gate 4: Missing sessionId returns 400
echo -n "4. Missing sessionId (400)... "
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$BASE_URL/api/orchestrator" \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-key" \
  -d '{"task":"echo hello"}')
[ "$HTTP" = "400" ] && echo "PASS" || { echo "FAIL HTTP $HTTP"; FAILED=1; }

# Gate 5: Missing task returns 400
echo -n "5. Missing task (400)... "
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$BASE_URL/api/orchestrator" \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-key" \
  -d '{"sessionId":"test"}')
[ "$HTTP" = "400" ] && echo "PASS" || { echo "FAIL HTTP $HTTP"; FAILED=1; }

echo ""
echo "=== DEFINITION OF DONE ==="
echo "North Star: Agent can execute tasks via API key"
echo ""
echo "To complete the full workflow:"
echo "  1. Sign up at $BASE_URL/signup"
echo "  2. Go to Settings > API Keys"
echo "  3. Create an API key"
echo "  4. Run: curl -X POST $BASE_URL/api/orchestrator \\"
echo "       -H 'x-api-key: <YOUR_KEY>' \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -d '{\"sessionId\":\"test\",\"task\":\"echo hello\"}'"
echo ""

[ $FAILED -eq 0 ] && echo "✅ Orchestrator gates passed" || echo "❌ $FAILED gates failed"
exit $FAILED
