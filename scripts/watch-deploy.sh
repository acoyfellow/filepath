#!/bin/bash
# Post-push monitor - watches GitHub Actions deployment
# Usage: ./scripts/watch-deploy.sh [--poll-interval=N] [--timeout=MINUTES]

set -e

cd "$(dirname "$0")/.."

POLL_INTERVAL="${POLL_INTERVAL:-10}"
TIMEOUT="${TIMEOUT:-15}"
REPO="${REPO:-$(git remote get-url origin | sed 's|https://github.com/||' | sed '/\.git$/d')}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== POST-PUSH DEPLOY MONITOR ===${NC}"
echo "Repo: $REPO"
echo "Polling every ${POLL_INTERVAL}s, timeout: ${TIMEOUT}min"
echo ""

# Get latest run
get_latest_run() {
    gh run list --limit 1 --json databaseId,conclusion,name,headBranch,createdAt
}

# Wait for new run to appear
wait_for_run() {
    local last_run_id="$1"
    local attempts=0
    local max_attempts=$((TIMEOUT * 60 / POLL_INTERVAL))
    
    while [ $attempts -lt $max_attempts ]; do
        local run_info=$(get_latest_run)
        local run_id=$(echo "$run_info" | jq -r '.[0].databaseId')
        
        if [ -n "$run_id" ] && [ "$run_id" != "null" ]; then
            if [ "$run_id" != "$last_run_id" ]; then
                echo "New run detected: $run_id"
                echo "$run_info" | jq '.'
                return 0
            fi
        fi
        
        attempts=$((attempts + 1))
        if [ $((attempts % 6)) -eq 0 ]; then
            echo -n "."
        fi
        sleep "$POLL_INTERVAL"
    done
    
    echo ""
    echo -e "${YELLOW}Timeout waiting for new run${NC}"
    return 1
}

# Monitor run status
monitor_run() {
    local run_id="$1"
    local start_time=$(date +%s)
    local max_attempts=$((TIMEOUT * 60 / POLL_INTERVAL))
    local attempts=0
    
    while [ $attempts -lt $max_attempts ]; do
        local run_info=$(gh run view "$run_id" --json databaseId,conclusion,name,status,headBranch)
        local status=$(echo "$run_info" | jq -r '.status')
        local conclusion=$(echo "$run_info" | jq -r '.conclusion // "null"')
        
        echo "[$(date '+%H:%M:%S')] Status: $status"
        
        if [ "$status" = "completed" ]; then
            echo ""
            if [ "$conclusion" = "success" ]; then
                echo -e "${GREEN}=== DEPLOY SUCCEEDED ===${NC}"
                echo "$run_info" | jq '{id, conclusion, branch: .headBranch, name}'
                return 0
            else
                echo -e "${RED}=== DEPLOY FAILED ===${NC}"
                echo "$run_info" | jq '{id, conclusion, branch: .headBranch, name}'
                echo ""
                echo "Logs:"
                gh run view "$run_id" --log 2>/dev/null | grep -A3 "error\|ERROR\|failed" | head -20
                return 1
            fi
        fi
        
        attempts=$((attempts + 1))
        sleep "$POLL_INTERVAL"
    done
    
    echo ""
    echo -e "${YELLOW}Timeout waiting for run completion${NC}"
    return 1
}

# Main
main() {
    echo "Getting current run..."
    local last_run_id=$(get_latest_run | jq -r '.[0].databaseId // "none"')
    echo "Last run: $last_run_id"
    
    echo ""
    echo "Push detected. Waiting for new workflow run..."
    
    if wait_for_run "$last_run_id"; then
        local new_run_id=$(get_latest_run | jq -r '.[0].databaseId')
        echo ""
        echo "Monitoring run: $new_run_id"
        monitor_run "$new_run_id"
    else
        echo -e "${YELLOW}Could not detect new run${NC}"
        exit 1
    fi
}

main "$@"
