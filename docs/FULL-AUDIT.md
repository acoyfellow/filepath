# Feature Theatre Audit - filepath

> Features that exist in UI/API but don't actually work in backend

Last updated: Feb 28, 2026

---

## 🔴 CRITICAL: Confirmed Broken

### 1. Git Repo Cloning — THE BIG ONE
- **UI:** Session creation has input field for "Git repo URL"
- **API:** `POST /api/sessions` accepts `gitRepoUrl`, stored in `agentSession.gitRepoUrl`
- **Display:** Shows in SessionSidebar with link icon
- **Backend:** `spawnContainer()` NEVER queries or uses `gitRepoUrl`
- **Impact:** Users think repo will be cloned, nothing happens
- **Fix Priority:** HIGHEST

---

## 🟡 YELLOW: Needs Verification

### 2. Per-Session API Keys
- **Schema:** `agentSession.api_key` exists (encrypted)
- **UI:** No UI found to actually set per-session key
- **Backend:** `spawnContainer()` queries `s.api_key` but may be unused
- **Status:** Verify if this feature has any UI path

### 3. Credit Balance / Billing
- **Schema:** `user.creditBalance`, `apikey.creditBalance`
- **UI:** Shows 10,000 credits in dashboard
- **Backend:** May not actually deduct or enforce limits
- **Question:** Is this actually enforced or just display?

### 4. Container Sandbox Execution
- **Code:** `spawnContainer()`, `forwardToContainer()` exist
- **Evidence:** WebSocket connects successfully
- **Question:** Does container actually execute? Or falling back to direct LLM?
- **Risk:** Fallback masks failures

### 5. Agent Spawning → Container Trigger
- **UI:** Spawn modal works, creates node
- **API:** `POST /api/sessions/[id]/nodes` creates DB row
- **Question:** Does node creation actually trigger ChatAgent DO to spawn container?
- **Verification needed:** Check if container spawns after node create

### 6. Tree Navigation Persistence
- **UI:** Tree component, clickable nodes
- **Question:** Does selecting a node load the correct chat history?
- **Risk:** Always showing orchestrator chat?

### 7. Session Status Transitions
- **Schema:** `agentSession.status` enum (draft|running|paused|stopped|error)
- **Question:** Do statuses actually update based on real state?
- **Risk:** Always showing "draft" or static status?

### 8. Dark Mode Persistence
- **UI:** Toggle exists in Nav
- **Question:** Is preference saved to localStorage/cookie?
- **Risk:** Resets on refresh?

---

## ✅ VERIFIED WORKING

- User signup/login (Better-Auth)
- Session CRUD (create, list, delete)
- Basic tree display
- WebSocket connection
- Chat message sending
- SQLite message persistence

---

## Action Plan

1. **Fix #1 (Git Repo)** — Immediate, high impact
2. **Verify yellow items** — One by one, write test gates
3. **Fix or Remove** — Don't leave broken features in UI
4. **Add gates** — Prevent regression
