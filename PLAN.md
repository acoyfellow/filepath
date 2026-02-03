# Implementation Plan - Agents SDK Architecture

## Current State (Feb 3, 2026)

✅ **Foundation Complete**
- Agents SDK installed (`agents@0.3.7`)
- TaskAgent DO structure defined
- Workflow classes created (ExecuteTask, CreateSession)
- Alchemy config updated
- Type checks passing

❌ **Not Yet Functional**
- Workflows use mock container execution
- No real API key validation
- No billing integration
- No real progress streaming

---

## Architecture Decision: Dual Interface Pattern

### TaskAgent provides TWO interfaces with ZERO duplication:

```typescript
export class TaskAgent extends Agent<Env, State> {
  
  // PRIMARY: RPC methods (@callable)
  // - Fast, typed, streaming-ready
  // - Used by: Agent SDK clients, workflows, internal calls
  @callable()
  async executeTask(sessionId: string, task: string, apiKey: string) {
    const user = await this.validateApiKey(apiKey);
    const workflowId = await this.runWorkflow('EXECUTE_TASK', {
      userId: user.id,
      sessionId,
      task
    });
    return { workflowId };
  }
  
  // SECONDARY: REST wrapper (fetch override)
  // - Thin layer for curl/external agents
  // - Extracts API key from header, calls @callable methods
  async fetch(request: Request): Promise<Response> {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) return Response.json({ error: 'Missing x-api-key' }, { status: 401 });
    
    if (url.pathname === '/api/orchestrator' && request.method === 'POST') {
      const { sessionId, task } = await request.json();
      const result = await this.executeTask(sessionId, task, apiKey);
      return Response.json(result);
    }
    
    return super.fetch(request); // Handle WebSocket connections
  }
}
```

**Why this works:**
- External agents (curl) → HTTP POST → `fetch()` → calls `@callable` method
- Web clients (SDK) → WebSocket → `agent.stub.executeTask()` → calls `@callable` method
- Workflows → `this.agent.executeTask()` → calls `@callable` method
- **Single source of truth** = `@callable` methods
- **Zero duplication** = REST is just routing

---

## Phase 1: Container Integration (NEXT)

### Goal: Execute real commands in real containers

#### 1.1 Update ExecuteTaskWorkflow

**File:** `src/agent/workflows/execute-task.ts`

```typescript
export class ExecuteTaskWorkflow extends AgentWorkflow<TaskAgent, ExecuteTaskParams, Progress, Env> {
  async run(event: { payload: ExecuteTaskParams }, step: AgentWorkflowStep) {
    const { userId, sessionId, task } = event.payload;
    
    // Step 1: Get or create container
    const containerId = await step.do('get-container', async () => {
      // Check if session already has a container
      let container = await this.state.get(`container:${sessionId}`);
      
      if (!container) {
        // Spawn new container
        const sandbox = await getSandbox(this.env.Sandbox);
        await sandbox.spawn({ image: 'our-image' });
        
        // Start ttyd for terminal access
        await sandbox.startProcess('ttyd -W -p 7681 bash');
        
        container = {
          id: sandbox.id,
          sessionId,
          wsUrl: `wss://${sandbox.hostname}:7681`,
          createdAt: Date.now()
        };
        
        // Store in workflow state
        await this.state.set(`container:${sessionId}`, container);
      }
      
      return container;
    });
    
    // Step 2: Execute command
    const result = await step.do('execute-command', async () => {
      await this.reportProgress({ status: 'executing', command: task });
      
      const sandbox = await getSandbox(this.env.Sandbox, containerId.id);
      const output = await sandbox.exec(task);
      
      return output;
    });
    
    // Step 3: Report completion
    await this.reportProgress({ status: 'completed', output: result });
    
    return { success: true, result };
  }
}
```

#### 1.2 Create Container Helper

**File:** `src/lib/container.ts`

```typescript
import { getSandbox, type Sandbox } from '@cloudflare/sandbox';

export async function getOrCreateContainer(
  sandbox: typeof Sandbox,
  sessionId: string
): Promise<{ id: string; wsUrl: string }> {
  // Implementation
}

export async function execInContainer(
  sandbox: typeof Sandbox,
  containerId: string,
  command: string
): Promise<string> {
  // Implementation
}
```

#### 1.3 Test Container Execution

```bash
# Deploy
npm run deploy

# Test
curl -X POST https://myfilepath.com/api/orchestrator \
  -H "x-api-key: test-key" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test-1","task":"echo hello && pwd"}'

# Verify container actually runs command
```

**Success criteria:**
- Container spawns
- Command executes
- Output returns
- Container persists for future tasks

---

## Phase 2: Auth & Billing Integration

### 2.1 Real API Key Validation

**File:** `src/agent/index.ts`

```typescript
private async validateApiKey(key: string): Promise<{ id: string; userId: string }> {
  // Hash the key
  const hashedKey = await this.hashApiKey(key);
  
  // Query D1 database
  const result = await this.sql<{ id: string; user_id: string; expires_at: string }>`
    SELECT id, user_id, expires_at 
    FROM apikey 
    WHERE hashed_key = ${hashedKey} 
    LIMIT 1
  `;
  
  if (result.length === 0) {
    throw new Error('Invalid API key');
  }
  
  const apikey = result[0];
  
  // Check expiration
  if (apikey.expires_at && new Date(apikey.expires_at) < new Date()) {
    throw new Error('API key expired');
  }
  
  return { id: apikey.id, userId: apikey.user_id };
}
```

### 2.2 Credit Deduction in Workflow

```typescript
// In ExecuteTaskWorkflow, after task completes
await step.do('deduct-credits', async () => {
  const duration = Date.now() - startTime;
  const creditsUsed = Math.ceil(duration / 60000); // 1 credit per minute
  
  await this.agent.deductCredits(userId, creditsUsed);
});
```

---

## Phase 3: Progress Streaming

### 3.1 WebSocket Connection

Clients connect to Agent DO:

```javascript
const ws = new WebSocket('wss://api.myfilepath.com/agent/task-agent/default');
ws.onmessage = (msg) => {
  const data = JSON.parse(msg.data);
  console.log('Progress:', data);
};
```

### 3.2 Broadcast from Workflow

```typescript
// Workflow reports progress
await this.reportProgress({ 
  status: 'running', 
  output: 'Building project...' 
});

// Agent receives via onWorkflowProgress()
// Agent broadcasts to all WebSocket clients
this.broadcast(JSON.stringify({ workflowId, ...progress }));
```

### 3.3 HTTP Polling Fallback

```bash
curl https://myfilepath.com/api/workflow/abc-123/status
# Returns: {"status": "running", "progress": 45}
```

---

## Phase 4: E2E Testing

### 4.1 Automated Gate

**File:** `gates/agents-sdk-e2e.sh`

```bash
#!/bin/bash
set -e

# 1. Sign up
RESPONSE=$(curl -s -X POST https://myfilepath.com/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test"}')

echo "✅ Signup successful"

# 2. Create API key (manual for now - need to implement API endpoint)
# API_KEY=...

# 3. Create session
SESSION=$(curl -s -X POST https://myfilepath.com/api/orchestrator/session \
  -H "x-api-key: $API_KEY" | jq -r '.sessionId')

echo "✅ Session created: $SESSION"

# 4. Execute task
WORKFLOW=$(curl -s -X POST https://myfilepath.com/api/orchestrator \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"'$SESSION'","task":"echo test && pwd"}' | jq -r '.workflowId')

echo "✅ Task submitted: $WORKFLOW"

# 5. Poll for completion
for i in {1..30}; do
  STATUS=$(curl -s https://myfilepath.com/api/workflow/$WORKFLOW/status | jq -r '.status')
  if [ "$STATUS" = "completed" ]; then
    echo "✅ Task completed successfully"
    exit 0
  fi
  sleep 2
done

echo "❌ Task did not complete in time"
exit 1
```

---

## Phase 5: Production Readiness

### 5.1 Observability
- [ ] Add structured logging in workflows
- [ ] Track metrics (task duration, success rate)
- [ ] Error alerting

### 5.2 Resource Limits
- [ ] Max execution time per task
- [ ] Max containers per user
- [ ] Memory/CPU limits

### 5.3 Cost Controls
- [ ] Credit balance checks before execution
- [ ] Auto-shutdown idle containers
- [ ] Usage reports

### 5.4 Documentation
- [ ] API reference for agents
- [ ] SDK examples (JS, Python, curl)
- [ ] Troubleshooting guide

---

## Questions to Answer

### Container Lifecycle
- **Q:** How long should containers live?
- **A:** Until explicitly closed or 24h idle timeout

### Multi-container Tasks
- **Q:** Can one task use multiple containers?
- **A:** Phase 6 - start with one container per session

### Approval Gates
- **Q:** When would we pause for human approval?
- **A:** Destructive operations, spending above limit, ambiguous requests

### MCP Integration
- **Q:** Should workflows have MCP tool access?
- **A:** Yes, Phase 7 - workflows can use Agent's MCP servers

---

## Next Immediate Actions

1. ✅ Update README with Agents SDK architecture
2. ✅ Create .env.example with Deja config
3. ✅ Solidify plan (this document)
4. ✅ Push to main branch
5. ➡️ Implement real container execution in workflows
6. ➡️ Test with actual commands
7. ➡️ Add API key validation
8. ➡️ Wire up progress streaming

---

## Success Criteria

**MVP is done when:**
- ✅ Agent can signup via API
- ✅ Agent gets API key
- ✅ Agent creates session (spawns container)
- ✅ Agent submits task (runs command in container)
- ✅ Task executes in real container
- ✅ Progress streams back in real-time
- ✅ Credits deducted correctly
- ✅ Container persists for future tasks
- ✅ E2E test passes

**Then we can dogfood it.**
