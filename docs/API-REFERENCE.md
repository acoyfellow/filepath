# API Reference - myfilepath.com

Last updated: Feb 5, 2026

## Authentication

All orchestrator endpoints require an API key via the `x-api-key` header.

```bash
curl -H "x-api-key: YOUR_KEY" https://myfilepath.com/api/...
```

### Getting an API Key

1. Sign up at https://myfilepath.com/signup
2. Navigate to https://myfilepath.com/settings/api-keys
3. Create a new API key
4. Store the key securely (shown once)

---

## Orchestrator Endpoints

### POST /api/orchestrator/session

Create a new container session.

**Request:**
```bash
curl -X POST https://myfilepath.com/api/orchestrator/session \
  -H "x-api-key: YOUR_KEY"
```

**Response:**
```json
{
  "workflowId": "session-abc123",
  "sessionId": "sess-xyz789"
}
```

**Status:** 🔄 Mock implementation (returns placeholder)

---

### POST /api/orchestrator

Execute a task in a session.

**Request:**
```bash
curl -X POST https://myfilepath.com/api/orchestrator \
  -H "x-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sess-xyz789",
    "task": "echo hello && ls -la"
  }'
```

**Response:**
```json
{
  "workflowId": "task-def456"
}
```

**Status:** 🔄 Mock implementation

---

## Auth Endpoints

Powered by better-auth.

### POST /api/auth/sign-up/email

Create a new account.

**Request:**
```bash
curl -X POST https://myfilepath.com/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "secure123",
    "name": "User Name"
  }'
```

**Response:**
```json
{
  "user": {"id": "...", "email": "...", "name": "..."},
  "session": {"token": "..."}
}
```

---

### POST /api/auth/sign-in/email

Sign in with email/password.

**Request:**
```bash
curl -X POST https://myfilepath.com/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "secure123"
  }'
```

---

### POST /api/auth/sign-out

Sign out current session.

---

## Billing Endpoints

### POST /api/billing/create-checkout-session

Create a Stripe checkout session for purchasing credits.

**Request:**
```bash
curl -X POST https://myfilepath.com/api/billing/create-checkout-session \
  -H "Content-Type: application/json" \
  --cookie "session=..." \
  -d '{
    "amount": 1000
  }'
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/..."
}
```

---

### GET /api/billing/balance

Get current credit balance.

**Response:**
```json
{
  "credits": 500,
  "currency": "usd"
}
```

---

## WebSocket Streaming

### wss://api.myfilepath.com/agent/task-agent/default

Real-time progress streaming for tasks.

**Connection:**
```javascript
const ws = new WebSocket('wss://api.myfilepath.com/agent/task-agent/default');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
  // { workflowId: "task-456", type: "progress", status: "running" }
};
```

**Status:** 🔄 Not yet implemented

---

## Error Responses

### 401 Unauthorized
```json
{"error": "Missing x-api-key header"}
```

### 403 Forbidden
```json
{"error": "Invalid API key"}
```

### 400 Bad Request
```json
{"error": "Missing required field: sessionId"}
```

### 500 Internal Server Error
```json
{"error": "Internal server error", "message": "..."}
```

---

## Rate Limits

**Current:** No rate limits enforced

**Planned:**
- 100 requests/minute per API key
- 10 concurrent sessions per user
- Burst allowance for bursty workloads

---

## Billing Model

- **Rate:** $0.01/minute of container time
- **Minimum purchase:** $10 (1000 credits)
- **1 credit = 1 minute** of container execution
- **Prepaid:** Credits purchased upfront via Stripe

---

## SDK Usage (TypeScript)

```typescript
// Using the Agents SDK RPC client
import { Agent } from 'agents';

const agent = new Agent('https://api.myfilepath.com');

// Create session
const { sessionId } = await agent.createSession();

// Execute task
const { workflowId } = await agent.executeTask(sessionId, 'npm install');

// Stream progress
agent.onProgress((event) => {
  console.log(`Task ${event.workflowId}: ${event.status}`);
});
```

**Note:** SDK client not yet published. Use REST API for now.
