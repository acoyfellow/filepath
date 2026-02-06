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
import { handleRequest as handleTerminalRequest } from './index';
import type { Env } from '../src/types';

// Export the Agent as a Durable Object
export { TaskAgent };

// Export workflow classes with binding names
export const EXECUTE_TASK = ExecuteTaskWorkflow;
export const CREATE_SESSION = CreateSessionWorkflow;

// Re-export Sandbox for Container binding
export { Sandbox } from '@cloudflare/sandbox';

// Helper to route to TaskAgent with proper name headers set
function routeToTaskAgent(request: Request, env: Env & { TaskAgent: DurableObjectNamespace }, name = 'default'): Promise<Response> {
  const id = env.TaskAgent.idFromName(name);
  const agent = env.TaskAgent.get(id);
  
  // Create new headers with partykit room header (sets Agent.name)
  const headers = new Headers(request.headers);
  headers.set('x-partykit-room', name);
  headers.set('x-partykit-namespace', 'task-agent');
  
  // Create new request with updated headers
  const req = new Request(request.url, {
    method: request.method,
    headers,
    body: request.body,
    redirect: request.redirect,
  });
  
  return agent.fetch(req);
}

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
    
    // Route terminal/*, session/*, debug/* to terminal handler
    // These are container/sandbox requests that don't need API key auth
    if (
      url.pathname.startsWith('/terminal/') ||
      url.pathname.startsWith('/session/') ||
      url.pathname === '/debug/container'
    ) {
      return handleTerminalRequest(request, env as any);
    }
    
    // Route /api/orchestrator to TaskAgent DO with proper name headers
    if (url.pathname.startsWith('/api/orchestrator')) {
      return routeToTaskAgent(request, env, 'default');
    }
    
    // Route /agents/* via routeAgentRequest for proper SDK handling
    if (url.pathname.startsWith('/agents/')) {
      const response = await routeAgentRequest(request, env, {
        cors: true,
      });
      if (response) return response;
    }
    
    // Default: route to TaskAgent with proper headers
    return routeToTaskAgent(request, env, 'default');
  },
};
