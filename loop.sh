#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════════
# loop.sh
# Run prd.ts until all gates pass, or crash after MAX_ATTEMPTS
# ═══════════════════════════════════════════════════════════════════════════════

ATTEMPTS=0
MAX_ATTEMPTS=${MAX_ATTEMPTS:-20}

mkdir -p .loop

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════════════╗"
echo "║  filepath loop                                                                ║"
echo "║  MAX_ATTEMPTS: $MAX_ATTEMPTS                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════════════════════╝"
echo ""

while true; do
  # Check for pause
  [[ -f .loop/PAUSED ]] && { echo "PAUSED - rm .loop/PAUSED to continue"; exit 0; }

  ((ATTEMPTS++))
  [[ $ATTEMPTS -gt $MAX_ATTEMPTS ]] && { echo "CRASHED after $MAX_ATTEMPTS attempts"; exit 1; }

  echo "═══════════════════════════════════════════════════════════════════════════════"
  echo "attempt $ATTEMPTS / $MAX_ATTEMPTS"
  echo "═══════════════════════════════════════════════════════════════════════════════"

  # Run prd.ts
  if bun run prd.ts 2>&1 | tee .loop/last.log; then
    echo ""
    echo "════════════════════════════════════════════════════════════════════════════════"
    echo "  DONE - all gates pass"
    echo "════════════════════════════════════════════════════════════════════════════════"
    exit 0
  fi

  # Pass to claude
  echo ""
  echo "→ piping prd.ts to claude..."
  echo ""

  cat prd.ts | claude --dangerously-skip-permissions --print 2>&1 | tee -a .loop/claude.log || true

  echo ""
  sleep 2
done
