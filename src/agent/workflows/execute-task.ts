import { AgentWorkflow, type AgentWorkflowStep } from 'agents/workflows';
import type { Env, ExecuteTaskParams } from '../../types';
import { getSandbox } from '@cloudflare/sandbox';

interface ExecuteTaskProgress {
  status: 'starting' | 'executing' | 'completed' | 'failed';
  output?: string;
  command?: string;
  exitCode?: number;
}

/**
 * Execute a task in a container session.
 * 
 * This workflow:
 * 1. Executes the task command in an existing container
 * 2. Returns output (stdout + stderr)
 * 3. Deducts credits from user account
 * 
 * Note: Container must already exist (created via CreateSessionWorkflow)
 */
export class ExecuteTaskWorkflow extends AgentWorkflow<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any, // TaskAgent type omitted to avoid recursion
  ExecuteTaskParams,
  ExecuteTaskProgress,
  Env
> {
  async run(
    event: { payload: ExecuteTaskParams },
    step: AgentWorkflowStep
  ): Promise<{ success: boolean; result?: string; exitCode?: number; error?: string }> {
    const { userId, sessionId, task } = event.payload;
    const startTime = Date.now();
    
    // Report start
    await this.reportProgress({ status: 'starting', command: task });
    
    try {
      // Step 1: Execute command in container
      const execResult = await step.do('execute-command', async () => {
        await this.reportProgress({
          status: 'executing',
          command: task,
        });
        
        // Get sandbox for this session's container
        const containerId = `container-${sessionId}`;
        const sandbox = getSandbox((this.env as Env).Sandbox as any, containerId);
        
        // Execute the command
        const result = await sandbox.exec(task);
        
        // Combine stdout and stderr for full output
        const output = [result.stdout, result.stderr]
          .filter(Boolean)
          .join('\n')
          .trim();
        
        return {
          success: result.success,
          exitCode: result.exitCode,
          output: output || '(no output)',
        };
      });
      
      // Step 2: Deduct credits
      await step.do('deduct-credits', async () => {
        const duration = Date.now() - startTime;
        const creditsUsed = Math.max(1, Math.ceil(duration / 60000)); // 1 credit per minute, minimum 1
        
        // Call Agent method to deduct credits
        // @ts-expect-error - Agent type recursion issue, works at runtime
        await this.agent.deductCredits?.({ userId, credits: creditsUsed });
      });
      
      // Report completion with exit code
      await this.reportProgress({
        status: execResult.success ? 'completed' : 'failed',
        output: execResult.output,
        exitCode: execResult.exitCode,
      });
      
      return {
        success: execResult.success,
        result: execResult.output,
        exitCode: execResult.exitCode,
      };
      
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
