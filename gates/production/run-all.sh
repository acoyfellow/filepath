#!/bin/bash
# Run all production gates in order
# Usage: ./gates/production/run-all.sh [base_url]
#
# Environment variables:
#   BASE_URL - Override base URL (default: https://myfilepath.com)
#   TEST_EMAIL - Test account email
#   TEST_PASSWORD - Test account password
#   TEST_API_KEY - Valid API key for credit tests

set -euo pipefail

BASE_URL="${1:-${BASE_URL:-https://myfilepath.com}}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FAILED=0
PASSED=0
TOTAL=0

echo "╔═══════════════════════════════════════╗"
echo "║  PRODUCTION GATES - myfilepath.com    ║"
echo "╠═══════════════════════════════════════╣"
echo "║  Target: $BASE_URL"
echo "╚═══════════════════════════════════════╝"
echo ""

GATES=(
  "visual-regression"
  "terminal-start"
  "credit-deduction"
  "billing-webhook"
)

for gate in "${GATES[@]}"; do
  TOTAL=$((TOTAL + 1))
  GATE_FILE="$SCRIPT_DIR/$gate.gate.sh"
  
  if [ ! -f "$GATE_FILE" ]; then
    echo "⚠️  Gate file not found: $gate.gate.sh"
    FAILED=$((FAILED + 1))
    continue
  fi
  
  echo "────────────────────────────────────────"
  echo "Running: $gate"
  echo "────────────────────────────────────────"
  
  if bash "$GATE_FILE" "$BASE_URL"; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1))
    echo ""
    echo "⚠️  Gate '$gate' failed! Continuing..."
  fi
  echo ""
done

echo "════════════════════════════════════════"
echo "PRODUCTION GATE RESULTS"
echo "════════════════════════════════════════"
echo "Total:  $TOTAL"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo "════════════════════════════════════════"

if [ $FAILED -eq 0 ]; then
  echo "✅ ALL PRODUCTION GATES PASSED"
  exit 0
else
  echo "❌ $FAILED GATE(S) FAILED"
  exit 1
fi
