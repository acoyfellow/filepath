/**
 * Worker entry point using Cloudflare Agents SDK.
 * 
 * This worker handles:
 * - Agent API requests (via Agent Durable Object)
 * - Long-running workflows (via Workflow classes)
 * - Container management (via existing Sandbox binding)
 */

import { routeAgentRequest } from 'agents';
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
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
        },
      });
    }
    
    // Route /api/orchestrator to TaskAgent DO directly
    if (url.pathname.startsWith('/api/orchestrator')) {
      const id = env.TaskAgent.idFromName('default');
      const agent = env.TaskAgent.get(id);
      return agent.fetch(request);
    }
    
    // Route /agents/* via routeAgentRequest for proper SDK handling
    if (url.pathname.startsWith('/agents/')) {
      const response = await routeAgentRequest(request, env, {
        cors: true,
      });
      if (response) return response;
    }
    
    // Default: route to TaskAgent
    const id = env.TaskAgent.idFromName('default');
    const agent = env.TaskAgent.get(id);
    return agent.fetch(request);
  },
};
