/**
 * Worker entry point using Cloudflare Agents SDK.
 * 
 * This worker handles:
 * - Agent API requests (via Agent class)
 * - Long-running workflows (via Workflow functions)
 * - Container management (via existing Sandbox binding)
 */

import { TaskAgent, workflows } from '../src/agent';
import type { Env } from '../src/types';

// Export the Agents SDK handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const agent = new TaskAgent(env);
    return agent.fetch(request, env, ctx);
  },
};

// Export workflows for the Agents SDK
export { workflows };

// Re-export Sandbox for Container binding
export { Sandbox } from '@cloudflare/sandbox';
