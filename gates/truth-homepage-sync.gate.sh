#!/bin/bash
# Gate: homepage "True Today" claims must be mirrored in the internal truth matrix with a real gate reference

set -euo pipefail

cd "$(dirname "$0")/.."

FAILED=0

echo "=== Homepage Truth Sync Gate ==="

CLAIMS=(
  "Cloudflare sandboxes with real isolation"
  "Supported harnesses, exact models, no extra lock-in"
  "Durable session state that reconnects cleanly"
  "Realtime session state across your devices"
  "Chat-first runtime visibility"
  "Move agents like files and folders"
)

for claim in "${CLAIMS[@]}"; do
  echo -n "- ${claim} appears on homepage... "
  if rg -F "$claim" src/routes/+page.svelte >/dev/null 2>&1; then
    echo "PASS"
  else
    echo "FAIL"
    FAILED=1
    continue
  fi

  echo -n "  ${claim} exists in truth matrix... "
  if rg -F "| ${claim} |" gates/truth-matrix.md >/dev/null 2>&1; then
    echo "PASS"
  else
    echo "FAIL"
    FAILED=1
    continue
  fi

  echo -n "  ${claim} has a gate reference... "
  if rg -F "| ${claim} |" gates/truth-matrix.md | rg -v "none yet" >/dev/null 2>&1; then
    echo "PASS"
  else
    echo "FAIL"
    FAILED=1
  fi
done

echo -n "- Homepage does not overclaim public sharing... "
if rg -n "shareable" src/routes/+page.svelte src/lib/components/HeroDemo.svelte src/app.html >/dev/null 2>&1; then
  echo "FAIL"
  FAILED=1
else
  echo "PASS"
fi

echo -n "- Homepage keeps only deferred roadmap items in the roadmap section... "
ROADMAP_COUNT="$(rg -o "tag: 'Roadmap'" src/routes/+page.svelte | wc -l | tr -d ' ')"
if rg -F "More routers, same contract" src/routes/+page.svelte >/dev/null 2>&1 \
  && [ "$ROADMAP_COUNT" = "1" ]; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=1
fi

echo
[ "$FAILED" -eq 0 ] && echo "✅ Homepage truth sync gate passed" || echo "❌ Homepage truth sync gate failed"
exit "$FAILED"
