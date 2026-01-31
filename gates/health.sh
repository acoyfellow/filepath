#!/bin/bash
# Health check for myfilepath - run between worker sessions
# Exit 0 = healthy, Exit 1 = blockers found
# Output is injected into next session prompt

cd "$(dirname "$0")/.." || exit 1

echo "=== UNCOMMITTED WORK CHECK ==="
UNCOMMITTED=$(git status --porcelain | grep -E "^( M|M |A |\?\?)" | head -10)
if [ -n "$UNCOMMITTED" ]; then
  echo "⚠️ UNCOMMITTED CHANGES DETECTED - Previous session didn't commit!"
  echo "$UNCOMMITTED"
  echo ""
  echo "🚨 COMMIT THESE FIRST before doing new work:"
  echo "   git add <files>"
  echo "   git commit -m 'description'"
  echo ""
  # Don't block, but make it VERY visible
fi

echo ""
echo "=== CODE QUALITY CHECKS ==="

# Check for explicit `any` usage
ANY_USAGE=$(grep -rEn ": any|as any|<any>" src/ worker/ --include="*.ts" --include="*.svelte" 2>/dev/null | grep -v node_modules | head -5)
if [ -n "$ANY_USAGE" ]; then
  echo "❌ Explicit 'any' detected. Use proper types:"
  echo "$ANY_USAGE"
  echo ""
  echo "Fix: Replace 'any' with specific type, 'unknown', or generic <T>"
  exit 1
fi
echo "✅ No explicit 'any'"

# Check for console.log (should use proper logging)
CONSOLE_LOG=$(grep -rEn "console\.(log|debug|info)" src/ --include="*.ts" --include="*.svelte" 2>/dev/null | grep -v node_modules | head -5)
if [ -n "$CONSOLE_LOG" ]; then
  echo "⚠️ console.log detected (remove before deploy):"
  echo "$CONSOLE_LOG" | head -3
  # Warning only, don't fail
fi

echo ""
echo "=== SVELTE 5 SYNTAX CHECK ==="
SVELTE4=$(grep -rEn "on:[a-z]+=" src/ --include="*.svelte" 2>/dev/null | head -5)
if [ -n "$SVELTE4" ]; then
  echo "❌ Svelte 4 syntax detected. Use onclick/onsubmit not on:click/on:submit:"
  echo "$SVELTE4"
  # Search past sessions for this issue
  ~/bin/shelley-recall "Svelte 4 syntax" 1 2>/dev/null
  exit 1
fi
echo "✅ Svelte 5 syntax OK"

echo ""
echo "=== BUILD CHECK ==="
ERRORS=$(npx tsc --noEmit 2>&1)
ERROR_COUNT=$(echo "$ERRORS" | grep -c "error TS")

if [ "$ERROR_COUNT" -gt 0 ]; then
  echo "❌ $ERROR_COUNT type errors. FIX BEFORE ADDING FEATURES:"
  # Show first 5 errors
  echo "$ERRORS" | grep "error TS" | head -5
  echo ""
  
  # Extract first error file for searching past sessions  
  FIRST_ERROR_FILE=$(echo "$ERRORS" | grep "error TS" | head -1 | cut -d'(' -f1)
  if [ -n "$FIRST_ERROR_FILE" ]; then
    ~/bin/shelley-recall "$FIRST_ERROR_FILE" 1 2>/dev/null
  fi
  
  echo "Use: grep -n 'pattern' <file> to locate, sed -n 'N,Mp' <file> to read context"
  exit 1
fi

echo "✅ Build passes"

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo ""
  echo "⚠️ Uncommitted changes:"
  git status --short
fi

exit 0

echo ""
echo "=== PROD SAFETY CHECKS ==="

# Check for hardcoded localhost that isn't behind env fallback
HARDCODED=$(grep -rEn "localhost:[0-9]+" src/ worker/ --include="*.ts" --include="*.svelte" 2>/dev/null | grep -v "import.meta.env\|process.env\|// " | head -3)
if [ -n "$HARDCODED" ]; then
  echo "⚠️ Hardcoded localhost (use env vars with fallback):"
  echo "$HARDCODED"
  # Warning only
fi

# Check for TODO/FIXME (incomplete work)
TODOS=$(grep -rEn "TODO|FIXME|HACK|XXX" src/ worker/ --include="*.ts" --include="*.svelte" 2>/dev/null | head -3)
if [ -n "$TODOS" ]; then
  echo "⚠️ TODOs found (address before shipping):"
  echo "$TODOS"
  # Warning only
fi

echo "✅ Prod safety checks done"
