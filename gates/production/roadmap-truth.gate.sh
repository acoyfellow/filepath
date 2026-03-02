#!/bin/bash
# Production Gate: Roadmap Truth
# Runs the live runtime truth gates against a deployed stack.
#
# This is the deployment-level proof layer for promoted roadmap claims.
# It intentionally excludes the mobile UI affordance gate because that is
# a source/UI contract check, not a deployment-runtime proof.
#
# Usage: ./gates/production/roadmap-truth.gate.sh [base_url]
# Env: TEST_EMAIL, TEST_PASSWORD

set -euo pipefail

BASE_URL="${1:-${BASE_URL:-https://myfilepath.com}}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_GATES_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== PRODUCTION GATE: ROADMAP TRUTH ==="
echo "Target: $BASE_URL"
echo ""

echo "Ensuring test user exists..."
if ! bash "$SCRIPT_DIR/ensure-test-user.sh" "$BASE_URL"; then
  echo ""
  echo "❌ Cannot provision test user for roadmap truth pass"
  exit 1
fi
echo ""

FAILED=0
PASSED=0

run_gate() {
  local label="$1"
  local file="$2"

  echo "────────────────────────────────────────"
  echo "Running: $label"
  echo "────────────────────────────────────────"

  if TEST_EMAIL="${TEST_EMAIL:-test-e2e-1770332875@example.com}" \
     TEST_PASSWORD="${TEST_PASSWORD:-TestPass123!}" \
     bash "$file" "$BASE_URL"; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1))
    echo ""
    echo "⚠️  Gate '$label' failed"
  fi
  echo ""
}

run_gate "thread-move" "$ROOT_GATES_DIR/truth-thread-move-desktop.gate.sh"
run_gate "file-handoff-failure" "$ROOT_GATES_DIR/truth-file-handoff-failure.gate.sh"
run_gate "cross-thread-file-handoff" "$ROOT_GATES_DIR/truth-cross-thread-file-handoff.gate.sh"

echo "════════════════════════════════════════"
echo "ROADMAP TRUTH RESULTS"
echo "════════════════════════════════════════"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo "════════════════════════════════════════"

if [ $FAILED -eq 0 ]; then
  echo "✅ ROADMAP TRUTH GATE: PASSED"
  exit 0
else
  echo "❌ ROADMAP TRUTH GATE: FAILED"
  exit 1
fi
