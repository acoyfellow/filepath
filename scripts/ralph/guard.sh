#!/bin/bash
# RALPH Loop Guard Script
# Validates constraints before allowing commits

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONSTRAINTS_FILE="$SCRIPT_DIR/constraints.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Exit codes
EXIT_SUCCESS=0
EXIT_GUARD_FAILURE=1

echo "🛡️  RALPH Guard: Running pre-commit checks..."

# Check if constraints file exists
if [ ! -f "$CONSTRAINTS_FILE" ]; then
    echo -e "${RED}❌ Constraints file not found: $CONSTRAINTS_FILE${NC}"
    exit $EXIT_GUARD_FAILURE
fi

# Check for secrets in staged files (actual API keys, not references)
echo "🔍 Checking for secrets..."
staged_files=$(git diff --cached --name-only)
if [ -n "$staged_files" ]; then
    if echo "$staged_files" | xargs grep -E "(sk-[a-zA-Z0-9]{20,}|api[_-]?key['\"]?\s*[:=]\s*['\"][a-zA-Z0-9]{20,})" 2>/dev/null | grep -v ".env.example"; then
        echo -e "${RED}❌ Potential secrets detected in staged files${NC}"
        echo "Please remove sensitive data before committing"
        exit $EXIT_GUARD_FAILURE
    fi
fi

# Check file sizes
echo "📏 Checking file sizes..."
MAX_SIZE_KB=500
git diff --cached --name-only -z | while IFS= read -r -d '' file; do
    if [ -f "$file" ]; then
        size_kb=$(du -k "$file" | cut -f1)
        if [ "$size_kb" -gt "$MAX_SIZE_KB" ]; then
            echo -e "${RED}❌ File too large: $file (${size_kb}KB > ${MAX_SIZE_KB}KB)${NC}"
            echo "Consider using Git LFS for large files or exclude from repository"
            exit $EXIT_GUARD_FAILURE
        fi
    fi
done

# Count changed files
echo "📊 Checking iteration size..."
num_files=$(git diff --cached --name-only | wc -l)
if [ "$num_files" -gt 10 ]; then
    echo -e "${YELLOW}⚠️  Warning: Many files changed ($num_files). Consider smaller iterations${NC}"
fi

# Check for untracked important files
echo "📁 Checking for untracked files..."
if git status --porcelain | grep "^??" | grep -E "\.(ts|js|svelte|json)$" | grep -v node_modules; then
    echo -e "${YELLOW}⚠️  Warning: Untracked source files detected${NC}"
    git status --porcelain | grep "^??" | grep -E "\.(ts|js|svelte|json)$" | grep -v node_modules
fi

echo -e "${GREEN}✅ All guard checks passed${NC}"
exit $EXIT_SUCCESS
