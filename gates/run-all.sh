#!/bin/bash
# Run all gate tests
cd "$(dirname "$0")"

FAILED=0
for gate in *.gate.sh; do
  [ -f "$gate" ] || continue
  echo "=== Running $gate ==="
  ./"$gate" || FAILED=1
  echo ""
done

[ $FAILED -eq 0 ] && echo "🎉 ALL GATES PASSED" || echo "💥 SOME GATES FAILED"
exit $FAILED
