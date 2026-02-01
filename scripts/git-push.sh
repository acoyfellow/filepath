#!/bin/bash
# Push with confidence - runs pre-push gates, pushes, then watches deploy
# Usage: ./scripts/git-push.sh [--skip-gates] [--skip-watch]

set -e

cd "$(dirname "$0")/.."

SKIP_GATES=0
SKIP_WATCH=0

for arg in "$@"; do
    case $arg in
        --skip-gates) SKIP_GATES=1 ;;
        --skip-watch) SKIP_WATCH=1 ;;
    esac
done

# Run pre-push gates
if [ $SKIP_GATES -eq 0 ]; then
    echo "Running pre-push gates..."
    if ! .git/hooks/pre-push; then
        echo "Gates failed. Aborting push."
        exit 1
    fi
    echo ""
fi

# Push
echo "Pushing to origin..."
git push origin main

# Watch deploy
if [ $SKIP_WATCH -eq 0 ]; then
    echo ""
    scripts/watch-deploy.sh
fi
