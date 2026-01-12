# Ralph loop directives

- PAUSED: false
- MAX_FAILURE_RETRIES: 3
- LOOP_OWNER: ralph
- STATE_FILES: AGENTS.md, scripts/ralph/prd.json, scripts/ralph/progress.txt, scripts/ralph/constraints.json, scripts/ralph/failure.json
- WORKFLOW: .github/workflows/ralph.yml
- ONE_STORY_PER_RUN: true
- UPDATE_PROGRESS_AFTER_SUCCESS: true
- NEVER_COMMIT_ON_GUARD_FAILURE: true
- STORY_SELECTION: pick first "todo" in prd.json, mark "doing", then "done" after guard passes
- VERIFICATION: run bash scripts/ralph/guard.sh scripts/ralph/constraints.json
- FAILURE_POLICY: increment failure.json, pause when consecutiveFailures >= MAX_FAILURE_RETRIES
- NOTES:
  - Keep commits minimal and scoped to the active story.
  - Respect allowedPaths in constraints.json when editing files.
  - Append learnings to scripts/ralph/progress.txt after a successful run.
