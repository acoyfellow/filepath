#!/bin/bash
# Gate: Git Repo Cloning — verifies repos are actually cloned into containers

set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== Git Repo Cloning Gate ==="
echo ""

FAILED=0

# 1. Verify API accepts gitRepoUrl
echo -n "1. API accepts gitRepoUrl... "
if grep -q "gitRepoUrl" src/routes/api/sessions/+server.ts && \
   grep -q "gitRepoUrl" src/lib/schema.ts; then
    echo "PASS"
else
    echo "FAIL (field not in API or schema)"
    FAILED=1
fi

# 2. Verify ChatAgent queries for git_repo_url
echo -n "2. ChatAgent queries git_repo_url... "
if grep -q "git_repo_url" src/agent/chat-agent.ts; then
    echo "PASS"
else
    echo "FAIL (ChatAgent doesn't query git_repo_url)"
    FAILED=1
fi

# 3. Verify cloneRepo is imported and called
echo -n "3. ChatAgent calls cloneRepo... "
if grep -q "import.*cloneRepo" src/agent/chat-agent.ts && \
   grep -q "cloneRepo(" src/agent/chat-agent.ts; then
    echo "PASS"
else
    echo "FAIL (cloneRepo not imported or called)"
    FAILED=1
fi

# 4. Verify clone happens before process start (check line numbers)
echo -n "4. Clone happens before agent start... "
CLONE_LINE=$(grep -n "cloneRepo(" src/agent/chat-agent.ts | head -1 | cut -d: -f1)
START_LINE=$(grep -n "startProcess(" src/agent/chat-agent.ts | head -1 | cut -d: -f1)
if [ -n "$CLONE_LINE" ] && [ -n "$START_LINE" ] && [ "$CLONE_LINE" -lt "$START_LINE" ]; then
    echo "PASS (clone at line $CLONE_LINE, start at $START_LINE)"
else
    echo "FAIL (clone: $CLONE_LINE, start: $START_LINE)"
    FAILED=1
fi

# 5. Type check
echo -n "5. TypeScript compiles... "
if bun run check 2>&1 | grep -q "error TS"; then
    echo "FAIL (TypeScript errors)"
    FAILED=1
else
    echo "PASS"
fi

echo ""
if [ $FAILED -eq 0 ]; then
    echo "✅ Git Repo Cloning Gate: PASSED"
    echo "   Repos will be cloned into /workspace before agent starts"
    exit 0
else
    echo "❌ Git Repo Cloning Gate: FAILED ($FAILED check(s))"
    exit 1
fi
