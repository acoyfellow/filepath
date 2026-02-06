import { AgentWorkflow, type AgentWorkflowStep } from 'agents/workflows';
import type { Env, CreateSessionParams } from '../../types';
import type { TaskAgent } from '../index';
import { getSandbox, type Sandbox } from '@cloudflare/sandbox';

interface CreateSessionProgress {
  status: 'creating' | 'starting-terminal' | 'ready' | 'failed';
  sessionId?: string;
  wsUrl?: string;
}

/**
 * Create a new container session.
 * 
 * This workflow:
 * 1. Spawns a new container
 * 2. Starts ttyd for terminal access
 * 3. Returns session info with WebSocket URL
 */
export class CreateSessionWorkflow extends AgentWorkflow<
  any, // TaskAgent - using any to avoid type recursion
  CreateSessionParams,
  CreateSessionProgress,
  Env
> {
  async run(
    event: { payload: CreateSessionParams },
    step: AgentWorkflowStep
  ): Promise<{ success: boolean; sessionId?: string; wsUrl?: string; error?: string }> {
    const { userId, sessionId } = event.payload;
    
    try {
      // Report start
      await this.reportProgress({ status: 'creating' });
      
      // Step 1: Create container
      const container = await step.do('create-container', async () => {
        // Use sessionId as container ID
        const containerId = `container-${sessionId}`;
        
        // Get sandbox (creates if doesn't exist)
        const sandbox = getSandbox((this.env as Env).Sandbox as any, containerId);
        
        // Note: Container hostname/endpoint is not directly accessible
        // We'll use the session ID to access it later
        return {
          id: containerId,
        };
      });
      
      // Step 2: Start ttyd for terminal access
      const wsUrl = await step.do('start-ttyd', async () => {
        await this.reportProgress({ status: 'starting-terminal' });
        
        const sandbox = getSandbox((this.env as Env).Sandbox as any, container.id);
        
        // Start ttyd on port 7681
        await sandbox.startProcess('ttyd -W -p 7681 bash');
        
        // WebSocket URL will be proxied through the worker
        // API_WS_HOST is set in alchemy.run.ts (e.g. 'api.myfilepath.com')
        const wsHost = (this.env as Env).API_WS_HOST || 'api.myfilepath.com';
        return `wss://${wsHost}/terminal/${sessionId}/ws`;
      });
      
      // Step 3: Store session info (no workflow state needed - using Cloudflare Containers built-in persistence)
      
      // Report completion
      await this.reportProgress({
        status: 'ready',
        sessionId,
        wsUrl,
      });
      
      return {
        success: true,
        sessionId,
        wsUrl,
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      await this.reportProgress({ status: 'failed' });
      
      return { success: false, error: errorMessage };
    }
  }
}
