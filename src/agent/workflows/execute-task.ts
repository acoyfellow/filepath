import type { WorkflowContext, WorkflowParams } from 'agents';
import type { Env } from '../../types';

interface ExecuteTaskParams {
  userId: string;
  sessionId: string;
  task: string;
}

/**
 * Execute a task in a container session.
 * 
 * This workflow:
 * 1. Gets or creates a container for the session
 * 2. Executes the task command
 * 3. Streams output back to the agent
 * 4. Tracks state in SQLite
 */
export async function executeTask(
  params: ExecuteTaskParams,
  context: WorkflowContext<Env>
): Promise<{ success: boolean; result?: string; error?: string }> {
  const { userId, sessionId, task } = params;
  
  // Get workflow state
  const state = context.state;
  
  try {
    // Store task start
    await state.set('startedAt', Date.now());
    await state.set('userId', userId);
    await state.set('sessionId', sessionId);
    await state.set('task', task);
    await state.set('status', 'running');
    
    // Broadcast progress
    context.broadcast({
      type: 'task-started',
      data: { sessionId, task },
    });
    
    // TODO: Get or create container
    // For now, simulate execution
    await context.sleep(1000); // Sleep for 1 second
    
    const result = `Task executed: ${task}`;
    
    // Update state
    await state.set('status', 'completed');
    await state.set('completedAt', Date.now());
    await state.set('result', result);
    
    // Broadcast completion
    context.broadcast({
      type: 'task-completed',
      data: { sessionId, result },
    });
    
    return { success: true, result };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Update state
    await state.set('status', 'failed');
    await state.set('error', errorMessage);
    
    // Broadcast error
    context.broadcast({
      type: 'task-failed',
      data: { sessionId, error: errorMessage },
    });
    
    return { success: false, error: errorMessage };
  }
}
