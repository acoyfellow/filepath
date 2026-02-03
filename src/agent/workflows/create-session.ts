import type { WorkflowContext } from 'agents';
import type { Env } from '../../types';

interface CreateSessionParams {
  userId: string;
}

/**
 * Create a new container session.
 * 
 * This workflow:
 * 1. Spawns a new container
 * 2. Starts ttyd for terminal access
 * 3. Returns session info
 */
export async function createSession(
  params: CreateSessionParams,
  context: WorkflowContext<Env>
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  const { userId } = params;
  
  try {
    // Store session start
    await context.state.set('userId', userId);
    await context.state.set('createdAt', Date.now());
    await context.state.set('status', 'creating');
    
    // Broadcast progress
    context.broadcast({
      type: 'session-creating',
      data: { userId },
    });
    
    // TODO: Create container via Cloudflare Containers API
    // For now, generate a mock session ID
    await context.sleep(500);
    
    const sessionId = `session-${Date.now()}`;
    
    // Update state
    await context.state.set('sessionId', sessionId);
    await context.state.set('status', 'ready');
    
    // Broadcast completion
    context.broadcast({
      type: 'session-created',
      data: { sessionId },
    });
    
    return { success: true, sessionId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Update state
    await context.state.set('status', 'failed');
    await context.state.set('error', errorMessage);
    
    // Broadcast error
    context.broadcast({
      type: 'session-failed',
      data: { error: errorMessage },
    });
    
    return { success: false, error: errorMessage };
  }
}
