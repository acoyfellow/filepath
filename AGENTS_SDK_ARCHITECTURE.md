# Agents SDK Architecture

## Overview

Fresh architecture using Cloudflare Agents SDK as the foundation for task orchestration.

## Core Components

### 1. TaskAgent (Durable Object)

**File:** `src/agent/index.ts`

```typescript
export class TaskAgent extends Agent<Env> {
  async onRequest(request: Request): Promise<Response>
  async onWorkflowProgress(name, id, progress): Promise<void>
}
```

**Responsibilities:**
- HTTP API interface (`/api/orchestrator`)
- API key validation
- Trigger workflows via `this.runWorkflow()`
- Stream progress to clients via WebSocket
- Durable Object state management

**Endpoints:**
- `GET /api/orchestrator` - Health check
- `POST /api/orchestrator` - Execute task (requires x-api-key)
- `POST /api/orchestrator/session` - Create session

### 2. Workflows

**Files:**
- `src/agent/workflows/execute-task.ts` - ExecuteTaskWorkflow
- `src/agent/workflows/create-session.ts` - CreateSessionWorkflow

```typescript
export class ExecuteTaskWorkflow extends AgentWorkflow<TaskAgent, Params, Progress, Env> {
  async run(event: { payload: Params }, step: AgentWorkflowStep): Promise<Result>
}
```

**Responsibilities:**
- Long-running task orchestration
- State persistence (automatic SQLite)
- Container lifecycle management
- Progress reporting to Agent
- Error handling and retries (built-in)

**Key Methods:**
- `step.do(name, fn)` - Idempotent execution step
- `this.reportProgress(data)` - Send progress to Agent
- `this.agent` - RPC to Agent Durable Object
- `this.broadcastToClients(msg)` - Send to WebSocket clients

### 3. Container Execution

**Binding:** `Sandbox` (Cloudflare Containers)

Workflows spawn and manage containers:

```typescript
const containerId = await step.do('create-container', async () => {
  const container = await env.Sandbox.create();
  // Start ttyd, return container ID
  return container.id;
});
```

### 4. Worker Entry Point

**File:** `worker/agent.ts`

```typescript
export { TaskAgent };
export const EXECUTE_TASK = ExecuteTaskWorkflow;
export const CREATE_SESSION = CreateSessionWorkflow;

export default {
  async fetch(request, env, ctx) {
    const id = env.TaskAgent.idFromName('default');
    const agent = env.TaskAgent.get(id);
    return agent.fetch(request);
  }
};
```

## Data Flow

### Task Execution Flow

```
1. Agent POST /api/orchestrator
   ↓
2. TaskAgent validates API key
   ↓
3. TaskAgent.runWorkflow('EXECUTE_TASK', params)
   ↓
4. ExecuteTaskWorkflow.run()
   ↓
5. step.do('create-container')
   → Spawn Cloudflare Container
   ↓
6. step.do('execute-task')
   → Run command in container
   ↓
7. reportProgress() → TaskAgent → WebSocket clients
   ↓
8. Return result (stored in Workflow SQLite)
```

### Progress Streaming

```
Workflow.reportProgress({ status: 'running' })
  ↓
Agent.onWorkflowProgress()
  ↓
Agent.broadcast(JSON.stringify({ ... }))
  ↓
WebSocket clients receive update
```

## State Management

### Agent State (Durable Object SQLite)
- Connection tracking
- API key cache (if needed)
- Client WebSocket connections

### Workflow State (Workflow SQLite)
- Task parameters
- Execution steps (idempotent via `step.do()`)
- Progress updates
- Final results
- Automatic persistence across retries

### Container State
- Container ID tracked in Workflow state
- Filesystem persists in container
- Can be long-lived (minutes to days)

## Deployment

### Alchemy Configuration

**File:** `alchemy.run.ts`

```typescript
const TASK_AGENT_DO = DurableObjectNamespace<TaskAgent>(
  `${projectName}-task-agent`,
  {
    className: "TaskAgent",
    scriptName: `${prefix}-worker`,
    sqlite: true
  }
);

const WORKER = await Worker(`${projectName}-worker`, {
  entrypoint: "./worker/agent.ts",
  bindings: {
    TaskAgent: TASK_AGENT_DO,
    Sandbox,
    DB,
  },
});
```

### Workflow Bindings

**Note:** Workflow bindings need to be added to wrangler.toml manually (not yet supported in Alchemy).

Expected wrangler.toml addition:
```toml
[[workflows]]
binding = "EXECUTE_TASK"
class_name = "ExecuteTaskWorkflow"

[[workflows]]
binding = "CREATE_SESSION"
class_name = "CreateSessionWorkflow"
```

## What Was Removed

### Old Architecture (Removed)
- ❌ Custom SessionDO for state management
- ❌ Manual orchestrator endpoint logic
- ❌ Custom retry/error handling
- ❌ Complex WebSocket routing

### New Architecture (Agents SDK)
- ✅ TaskAgent DO (single entry point)
- ✅ Workflow classes (long-running orchestration)
- ✅ Built-in state persistence
- ✅ Built-in progress streaming
- ✅ Built-in retry logic

## Benefits

1. **Less Code** - SDK handles state, retries, progress
2. **Better Patterns** - Clear separation: Agent (interface) / Workflow (orchestration) / Container (execution)
3. **Native CF Integration** - Built for Cloudflare Workers
4. **Automatic State** - SQLite persistence without manual tracking
5. **Progress Streaming** - Built-in broadcast mechanism
6. **Human-in-Loop** - Approval gates via `step.waitForEvent()`

## Next Steps

### Phase 1: Complete Container Integration
- [ ] Implement actual container spawning in Workflows
- [ ] Wire up ttyd WebSocket proxy
- [ ] Test long-running tasks (>1 hour)

### Phase 2: Auth Integration
- [ ] Validate API keys against D1
- [ ] Deduct credits in Workflows
- [ ] Track usage per user

### Phase 3: UI Integration
- [ ] Update frontend to connect to Agent WebSocket
- [ ] Display workflow progress in real-time
- [ ] Add workflow management UI

### Phase 4: E2E Testing
- [ ] Automated gate: signup → API key → execute task
- [ ] Test failure scenarios
- [ ] Test approval gates

## Testing

Type checks pass:
```bash
npx tsc --noEmit
# Only pre-existing errors in test-credits and og-image routes
```

To deploy:
```bash
npm run deploy
# Note: Workflow bindings need manual wrangler.toml edits
```
