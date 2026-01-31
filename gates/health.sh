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
ERRORS=$(npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0")
if [ "$ERRORS" -gt 0 ] 2>/dev/null; then
  echo "❌ $ERRORS type errors"
  npx tsc --noEmit 2>&1 | grep "error TS" | head -5
  exit 1
fi
echo "✅ Build passes"
