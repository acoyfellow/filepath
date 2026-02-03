/**
 * Worker entry point using Cloudflare Agents SDK.
 * 
 * This worker handles:
 * - Agent API requests (via Agent Durable Object)
 * - Long-running workflows (via Workflow classes)
 * - Container management (via existing Sandbox binding)
 */

import { TaskAgent } from '../src/agent';
import { ExecuteTaskWorkflow } from '../src/agent/workflows/execute-task';
import { CreateSessionWorkflow } from '../src/agent/workflows/create-session';
import type { Env } from '../src/types';

// Export the Agent as a Durable Object
export { TaskAgent };

// Export workflow classes with binding names
export const EXECUTE_TASK = ExecuteTaskWorkflow;
export const CREATE_SESSION = CreateSessionWorkflow;

// Re-export Sandbox for Container binding
export { Sandbox } from '@cloudflare/sandbox';

// Worker fetch handler routes to Agent Durable Object
export default {
  async fetch(request: Request, env: Env & { TaskAgent: DurableObjectNamespace }, ctx: ExecutionContext): Promise<Response> {
    // Get Agent Durable Object ID (for now, use a single agent instance)
    const id = env.TaskAgent.idFromName('default');
    const agent = env.TaskAgent.get(id);
    
    // Forward request to Agent DO
    return agent.fetch(request);
  },
};
