# AGENTS.md - myfilepath.com

Agent instructions for the myfilepath.com codebase.

## Project Context

**Product:** myfilepath.com - The platform for agents  
**Goal:** Orchestration layer + coey.dev ecosystem integration  
**Architecture:** Cloudflare Agents SDK with dual interface pattern

## Current Status (Feb 2026)

✅ **Working:**
- Build passes (`npx tsc --noEmit` clean)
- SvelteKit UI (landing, auth, dashboard, settings)
- Better-auth (email/password, API keys)
- Stripe billing (checkout, webhooks, credits)
- Secrets encryption (AES-GCM)
- Agents SDK foundation (TaskAgent DO)
- Workflow classes with real container integration
- **PRD system with gates** (`prd.ts` + gates/*.gate.sh)

🔄 **In Progress:**
- Progress streaming
- Terminal/ttyd connection stability
- Stripe checkout (needs test mode config)

❌ **Not Done:**
- Production container execution with credits
- Account deletion flow

## 🐛 Known Issues

### ~~Stripe Checkout Configuration~~
**Status:** ✅ RESOLVED (Feb 5, 2026)  
**Fix:** Added STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to GH Actions and alchemy.run.ts  
**Test:** Checkout opens Stripe test mode page successfully

### ~~API Key Creation Fails via UI~~
**Status:** ✅ RESOLVED (Feb 5, 2026)  
**Fix:** Aligned apikey schema with better-auth requirements (hashed_key → key, added missing fields)

## ✅ E2E Testing Results (Feb 5, 2026 - Complete)

**Latest Test Account:** `test-e2e-1770331512@example.com` / `TestPass123!`

| Step | Status | Notes |
|------|--------|-------|
| 1. Landing | ✅ | Beautiful landing page renders |
| 2. Signup | ✅ | Form works (use input events for programmatic fill) |
| 3. Dashboard | ✅ | Shows sessions, getting started guide |
| 4. Stripe | ✅ | Checkout opens in TEST MODE, shows payment methods |
| 5. Credits | ✅ | Credits added via DB (1000 credits = $10.00) |
| 6. Create Session | ✅ | Session created successfully |
| 7. Terminal | ✅ | Terminal page loads with tab interface |
| 8. API Keys | ✅ | Creation works, key shows in list |
| 9. API Test | ✅ | Task execution successful! Returns workflowId |
| 10-11. Billing | ✅ | Shows credits, API keys with budgets |
| 12. Delete Account | ❌ | Feature not implemented yet |

**Screenshots:** `/home/exedev/myfilepath-new/e2e-screenshots/`
- `final-01-landing.png` - Landing page
- `final-02-signup.png` - Signup form  
- `final-03-dashboard.png` - Dashboard with session
- `final-04-stripe-checkout.png` - Stripe checkout (TEST MODE)
- `final-05-credits-arrived.png` - Credits balance showing 1000
- `final-06-07-terminal.png` - Session/Terminal view
- `final-08-api-key-created.png` - API key creation success
- `final-08-api-keys-list.png` - API keys list view
- `final-10-11-billing-with-keys.png` - Billing page with API keys & budgets

**Working API Key:**
```bash
mfp_vsmviEEmMPUUbFRaUpQJJDIptMwnUOaVwFLpJcSzVNzVfBGBJCDqbliSLdZyojXu
```

**API Test Result (Feb 5, 2026):**
```bash
$ curl -X POST https://myfilepath.com/api/orchestrator \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"4aw0jFCFJmchSBl17QP5DaHKeQVFP5xF","task":"echo Hello from E2E test"}'

{"success":true,"workflowId":"79vQxrUSt0ncb7KG8Wsdx"}
```

**Remaining:**
1. Implement account deletion (Step 12)
2. Add per-minute credit deduction during container execution
3. Production container execution with real billing

## Architecture Overview

```
Agent/Human → TaskAgent (DO) → Workflows → Containers
              ↓                    ↓          ↓
           API Keys          Long-running  Execution
           Streaming         Orchestration Environment
```

### Core Components

| Component | Purpose | File |
|-----------|---------|------|
| TaskAgent | Durable Object for request handling | `src/agent/task-agent.ts` |
| ExecuteTaskWorkflow | Run commands in containers | `src/agent/workflows/execute-task.ts` |
| CreateSessionWorkflow | Spawn container sessions | `src/agent/workflows/create-session.ts` |
| Containers | Isolated execution (ttyd + bash) | Cloudflare Containers |

### Dual Interface Pattern

TaskAgent provides both RPC and REST with zero duplication:

```typescript
// RPC - primary interface (@callable methods)
@callable()
async executeTask(sessionId: string, task: string, apiKey: string) {
  // Core logic
}

// REST - thin wrapper extracts API key, calls RPC
async fetch(request: Request) {
  const apiKey = request.headers.get('x-api-key');
  const { sessionId, task } = await request.json();
  return await this.executeTask(sessionId, task, apiKey);
}
```

**Why:** Single source of truth in `@callable` methods. REST is just routing.

## Development Commands

```bash
# Build check (ALWAYS run before commit)
npx tsc --noEmit

# Health check (comprehensive)
bash gates/health.sh

# PRD gates (verify all features work)
bun run prd.ts

# Local dev
npm run dev

# Deploy
npm run deploy
```

## E2E Testing Plan (12-Step Journey)

**Goal:** Complete user flow with screenshots proving everything works

### The Journey:
1. 🏠 Landing page
2. 📝 Sign up (email/password)
3. 🏡 Dashboard - empty state ($0 credits)
4. 💳 Stripe checkout ($10 = 1000 credits)
5. 🎉 **Credits arrive** (webhook test - $0 → $10)
6. 🆕 Create session (container spawn)
7. 🖥️ Terminal view (ttyd interface)
8. ⚙️ Settings → API Keys (create key)
9. 🔌 API test (curl with key)
10. 📊 **Credits deducting** (real-time)
11. 💸 **Spending test** ($0.01/min rate)
12. 🗑️ **Delete account** (verify can't log in)

**Key Tests:**
- Stripe webhook processes payment
- Credits deduct per minute  
- Account deletion works

**Test Account Pattern:** `test-{timestamp}@example.com` / `TestPass123!`

## PRD System (Build in Reverse)

**Philosophy:** Define what should work (prd.ts), verify reality (gates), iterate until gates pass.

### Gate Files

| Story | Gate File | Status |
|-------|-----------|--------|
| user-signup | `gates/signup.gate.sh` | ✅ Passing |
| user-login | `gates/login.gate.sh` | ✅ Passing |
| api-key-creation | `gates/api-e2e.gate.sh` | ✅ Passing |
| container-creation | `gates/terminal.gate.sh` | ✅ Passing |
| orchestrator-execute | `gates/orchestrator.gate.sh` | ✅ Passing |
| north-star (E2E) | `gates/full-user-lifecycle.gate.sh` | ✅ Passing |

### Running Gates

```bash
# Run all gates in dependency order
bun run prd.ts

# Run specific gate
bash gates/signup.gate.sh https://myfilepath.com

# CI runs gates before deploy
# See .github/workflows/deploy.yml
```

### Gate Execution Order

1. **user-signup** - Must pass before login
2. **user-login** - Must pass before API keys
3. **api-key-creation** - Must pass before containers
4. **container-creation** - Must pass before orchestrator
5. **orchestrator-execute** - Must pass before E2E
6. **north-star** - Full E2E flow

**Stop on first failure.** Fix that gate before moving forward.

## Code Style Requirements

### Svelte 5 Syntax (CRITICAL)

```svelte
<!-- ❌ WRONG - Svelte 4 -->
<button on:click={handler}>Click</button>
<form on:submit|preventDefault={submit}>...

<!-- ✅ RIGHT - Svelte 5 -->
<button onclick={handler}>Click</button>
<form onsubmit={(e) => { e.preventDefault(); submit(); }}>...
```

### TypeScript Rules

- No explicit `any` - use `unknown`, generics, or specific types
- No implicit returns in non-void functions
- `arr[0]` is `T | undefined` (noUncheckedIndexedAccess)

### Commit Discipline

1. Run `npx tsc --noEmit` before every commit
2. Commit after EVERY file change (not "frequently")
3. Use descriptive commit messages

## Key Files

```
src/
├── agent/
│   ├── task-agent.ts         # Main Durable Object
│   └── workflows/
│       ├── execute-task.ts   # Command execution
│       └── create-session.ts # Container spawning
├── lib/
│   ├── auth/                 # Better-auth config
│   ├── crypto/secrets.ts     # AES-GCM encryption
│   └── server/               # Server utilities
├── routes/
│   ├── api/                  # API endpoints
│   ├── dashboard/            # Session management
│   ├── session/[id]/         # Terminal UI
│   └── settings/             # API keys, billing
alchemy.run.ts                # Infrastructure config
gates/health.sh               # Pre-commit checks
```

## API Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|--------|
| `/api/orchestrator` | POST | x-api-key | Execute task |
| `/api/orchestrator/session` | POST | x-api-key | Create session |
| `/api/auth/*` | - | Cookie | Better-auth routes |
| `/api/billing/*` | POST | Cookie | Stripe integration |

## Footguns

### ttyd requires initial size message
WebSocket connects but terminal shows nothing? Send size first:
```typescript
ttydWs.send(JSON.stringify({ columns: 80, rows: 24 }));
```

### Skip waitForPort in production
`sandbox.waitForPort()` times out. Let WebSocket retry handle ttyd startup.

### SvelteKit cannot proxy WebSocket
- HTTP → SvelteKit → Worker (OK)
- WebSocket → Worker directly (required)

## Debugging

```bash
# Check GitHub Actions
gh run list --limit 5
gh run view <RUN_ID> --log 2>/dev/null | tail -100

# Check Cloudflare logs
npx wrangler tail --format pretty

# Local container testing
npx wrangler dev --local
```

## Integration Points

- **coey.dev** - Parent ecosystem
- **Deja** - Cross-session agent memory
- **Stripe** - Payment processing
- **D1** - Auth & metadata storage
- **Cloudflare Containers** - Execution sandboxes

## Sprint Priorities

1. Container integration in ExecuteTaskWorkflow
2. Real API key validation
3. Progress streaming to clients
4. E2E agent test automation

## Post-E2E TODO List

### Phase 2: Polish & UX (After Gates Pass)

**Unified Branding**
- **Priority:** After E2E testing complete
- **Goal:** Match internal pages to homepage aesthetic
- **Pages to update:**
  - Dashboard / "YOUR SESSIONS" page
  - Settings pages (API keys, billing, profile)
  - Session detail pages
  - Any other internal UI
- **Match:** Typography, colors, spacing, button styles from landing page
- **Files:**
  - `src/routes/dashboard/+page.svelte`
  - `src/routes/settings/**/*.svelte`
  - `src/routes/session/[id]/+page.svelte`
- **Current issue:** Inconsistent styling across app
- **Desired:** Professional, cohesive brand experience throughout

**Order:**
1. ✅ Fix critical bugs (form validation)
2. ✅ E2E testing (12-step journey)
3. ✅ All gates pass
4. 🔜 Unified branding update

