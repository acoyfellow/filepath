import { AgentWorkflow, type AgentWorkflowStep } from 'agents/workflows';
import type { Env } from '../../types';
import type { TaskAgent } from '../index';
import { getSandbox } from '@cloudflare/sandbox';

interface ExecuteTaskParams {
  userId: string;
  sessionId: string;
  task: string;
}

interface ExecuteTaskProgress {
  status: 'starting' | 'creating-container' | 'executing' | 'completed' | 'failed';
  output?: string;
  command?: string;
}

/**
 * Execute a task in a container session.
 * 
 * This workflow:
 * 1. Gets or creates a container for the session
 * 2. Executes the task command
 * 3. Streams output back to the agent
 * 4. Deducts credits from user account
 * 5. Returns final result
 */
export class ExecuteTaskWorkflow extends AgentWorkflow<
  any, // TaskAgent - using any to avoid type recursion
  ExecuteTaskParams,
  ExecuteTaskProgress,
  Env
> {
  async run(
    event: { payload: ExecuteTaskParams },
    step: AgentWorkflowStep
  ): Promise<{ success: boolean; result?: string; error?: string }> {
    const { userId, sessionId, task } = event.payload;
    const startTime = Date.now();
    
    // Report start
    await this.reportProgress({ status: 'starting' });
    
    try {
      // Step 1: Get or create container
      const container = await step.do('get-or-create-container', async () => {
        await this.reportProgress({ status: 'creating-container' });
        
        // Check if this session already has a container
        // For now, use sessionId as containerId directly
        const containerId = `container-${sessionId}`;
        
        // Get sandbox (creates if doesn't exist)
        const sandbox = getSandbox((this.env as Env).Sandbox, containerId);
        
        // Start ttyd for terminal access (non-blocking)
        // This will spawn the container if it doesn't exist
        await sandbox.startProcess('ttyd -W -p 7681 bash');
        
        return {
          id: containerId,
          sessionId,
        };
      });
      
      // Step 2: Execute command in container
      const result = await step.do('execute-command', async () => {
        await this.reportProgress({
          status: 'executing',
          command: task,
        });
        
        // Get sandbox instance
        const sandbox = getSandbox((this.env as Env).Sandbox, container.id);
        
        // Execute the command
        const result = await sandbox.exec(task);
        
        // Extract stdout from ExecResult
        return result.stdout || '';
      });
      
      // Step 3: Deduct credits
      await step.do('deduct-credits', async () => {
        const duration = Date.now() - startTime;
        const creditsUsed = Math.ceil(duration / 60000); // 1 credit per minute, minimum 1
        
        // Call Agent method to deduct credits
        // @ts-expect-error - Agent type recursion issue
        await this.agent.deductCredits({
          userId,
          credits: creditsUsed,
        });
      });
      
      // Report completion
      await this.reportProgress({
        status: 'completed',
        output: result,
      });
      
      return { success: true, result };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      await this.reportProgress({
        status: 'failed',
        output: errorMessage,
      });
      
      return { success: false, error: errorMessage };
    }
  }
}
