import { Agent } from 'agents';
import type { Env } from '../types';
import { executeTask } from './workflows/execute-task';
import { createSession } from './workflows/create-session';

/**
 * TaskAgent handles incoming requests from agents (API key auth)
 * and orchestrates long-running tasks via Workflows.
 */
export class TaskAgent extends Agent<Env> {
  /**
   * Handle incoming HTTP requests
   */
  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // Health check
    if (request.method === 'GET' && url.pathname === '/api/orchestrator') {
      return Response.json({ status: 'ok', version: '2.0-agents-sdk' });
    }
    
    // POST /api/orchestrator - execute task
    if (request.method === 'POST' && url.pathname === '/api/orchestrator') {
      return this.handleExecuteTask(request);
    }
    
    // POST /api/orchestrator/session - create session
    if (request.method === 'POST' && url.pathname === '/api/orchestrator/session') {
      return this.handleCreateSession(request);
    }
    
    return new Response('Not Found', { status: 404 });
  }
  
  /**
   * Validate API key from request header
   */
  private async validateApiKey(request: Request): Promise<{ valid: boolean; userId?: string; error?: string }> {
    const apiKey = request.headers.get('x-api-key');
    
    if (!apiKey) {
      return { valid: false, error: 'Missing x-api-key header' };
    }
    
    // TODO: Validate against D1 database
    // For now, accept any key
    return { valid: true, userId: 'test-user' };
  }
  
  /**
   * Handle task execution request
   */
  private async handleExecuteTask(request: Request): Promise<Response> {
    // Validate API key
    const auth = await this.validateApiKey(request);
    if (!auth.valid) {
      return Response.json({ error: auth.error }, { status: 401 });
    }
    
    // Parse request body
    let body: { sessionId?: string; task?: string };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    
    if (!body.sessionId) {
      return Response.json({ error: 'Missing sessionId' }, { status: 400 });
    }
    
    if (!body.task) {
      return Response.json({ error: 'Missing task' }, { status: 400 });
    }
    
    // Trigger workflow
    const workflowId = await this.runWorkflow('executeTask', {
      userId: auth.userId!,
      sessionId: body.sessionId,
      task: body.task,
    });
    
    return Response.json({
      success: true,
      workflowId,
      message: 'Task started',
    });
  }
  
  /**
   * Handle session creation request
   */
  private async handleCreateSession(request: Request): Promise<Response> {
    // Validate API key
    const auth = await this.validateApiKey(request);
    if (!auth.valid) {
      return Response.json({ error: auth.error }, { status: 401 });
    }
    
    // Trigger workflow
    const workflowId = await this.runWorkflow('createSession', {
      userId: auth.userId!,
    });
    
    return Response.json({
      success: true,
      workflowId,
      message: 'Session creation started',
    });
  }
  
  /**
   * Stream workflow progress to client
   */
  async onWorkflowProgress(
    name: string,
    id: string,
    progress: { type: string; data: unknown }
  ): Promise<void> {
    // Broadcast progress to all connected clients
    this.broadcast({
      workflowName: name,
      workflowId: id,
      ...progress,
    });
  }
}

// Export workflow functions
export const workflows = {
  executeTask,
  createSession,
};
