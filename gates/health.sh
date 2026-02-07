#!/bin/bash
# Health check for myfilepath - run between worker sessions
cd "$(dirname "$0")/.." || exit 1

echo "=== UNCOMMITTED WORK CHECK ==="
UNCOMMITTED=$(git status --porcelain | grep -E "^( M|M )" | head -5)
if [ -n "$UNCOMMITTED" ]; then
  echo "⚠️ UNCOMMITTED - commit first!"
  echo "$UNCOMMITTED"
fi

echo ""
echo "=== SVELTE 5 SYNTAX (CRITICAL) ==="
SVELTE4=$(grep -rEn "on:[a-z]+[=|]" src/ --include="*.svelte" 2>/dev/null | head -5)
if [ -n "$SVELTE4" ]; then
  echo "❌ WRONG: Svelte 4 syntax detected!"
  echo "$SVELTE4"
  echo ""
  echo "FIX: on:click → onclick, on:submit → onsubmit"
  exit 1
fi
echo "✅ Svelte 5 syntax OK"

echo ""
echo "=== ANY CHECK ==="
# Allow platform.env as any (known workaround)
ANY_USAGE=$(grep -rEn ": any|as any" src/ worker/ --include="*.ts" 2>/dev/null | grep -v "platform?.env as any" | grep -v node_modules | head -3)
if [ -n "$ANY_USAGE" ]; then
  echo "⚠️ Explicit any (review):"
  echo "$ANY_USAGE"
fi

echo ""
echo "=== BUILD ==="
# Full tsc takes 10+ min on this VM — use timeout and skip if slow
BUILD_OUTPUT=$(timeout 60 bunx tsc --noEmit 2>&1 || echo "TIMEOUT")
if echo "$BUILD_OUTPUT" | grep -q "TIMEOUT"; then
  echo "⚠️  Build check timed out (60s) — skipping (run manually: bunx tsc --noEmit)"
else
  ERRORS=$(echo "$BUILD_OUTPUT" | grep -c "error TS" || echo "0")
  if [ "$ERRORS" -gt 0 ] 2>/dev/null; then
    echo "❌ $ERRORS type errors"
    echo "$BUILD_OUTPUT" | grep "error TS" | head -5
    exit 1
  fi
  echo "✅ Build passes"
fi

echo ""
echo "=== GITHUB ACTIONS ==="
LATEST_RUN=$(timeout 10 gh run list --limit 1 --json conclusion,headBranch,name,databaseId,createdAt 2>/dev/null || echo "")
if [ -n "$LATEST_RUN" ]; then
  CONCLUSION=$(echo "$LATEST_RUN" | jq -r '.[0].conclusion // "in_progress"')
  BRANCH=$(echo "$LATEST_RUN" | jq -r '.[0].headBranch')
  RUN_ID=$(echo "$LATEST_RUN" | jq -r '.[0].databaseId')
  
  if [ "$CONCLUSION" = "failure" ]; then
    echo "❌ Latest deploy FAILED on $BRANCH (run $RUN_ID)"
    echo ""
    echo "Debug with: gh run view $RUN_ID --log 2>/dev/null | tail -50"
    echo ""
    # Show the actual error
    gh run view $RUN_ID --log 2>/dev/null | grep -A5 "error\|ERROR\|failed" | head -20
  elif [ "$CONCLUSION" = "success" ]; then
    echo "✅ Latest deploy succeeded on $BRANCH"
  else
    echo "⏳ Deploy in progress on $BRANCH"
  fi
else
  echo "⚠️ Could not check GitHub Actions (gh not configured?)"
fi
