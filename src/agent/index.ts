import { Agent, callable } from 'agents';
import type { Env } from '../types';
import { drizzle } from 'drizzle-orm/d1';
import { apikey } from '$lib/schema';
import { eq } from 'drizzle-orm';

interface AgentState {
  // User sessions and container registry
  sessions: Record<string, { containerId: string; createdAt: number }>;
}

/**
 * TaskAgent handles incoming requests from agents and humans.
 * 
 * Dual interface pattern:
 * - @callable() methods for RPC (primary - fast, typed, streaming)
 * - fetch() override for REST (secondary - thin wrapper for external agents)
 */
export class TaskAgent extends Agent<Env, AgentState> {
  initialState: AgentState = {
    sessions: {},
  };

  /**
   * Execute a task in a container session.
   * 
   * PRIMARY interface - called by:
   * - Agent SDK clients (browser/Node.js)
   * - Workflows (this.agent.executeTask())
   * - REST wrapper (this.fetch())
   */
  @callable({ description: 'Execute a task in a container session' })
  async executeTask(params: {
    sessionId: string;
    task: string;
    apiKey: string;
  }): Promise<{ workflowId: string }> {
    const { sessionId, task, apiKey } = params;
    
    // Validate API key
    const user = await this.validateApiKey(apiKey);
    
    // Trigger workflow
    const workflowId = await this.runWorkflow('EXECUTE_TASK', {
      userId: user.id,
      sessionId,
      task,
    });
    
    return { workflowId };
  }

  /**
   * Create a new container session.
   * 
   * PRIMARY interface - called by:
   * - Agent SDK clients
   * - Workflows
   * - REST wrapper
   */
  @callable({ description: 'Create a new container session' })
  async createSession(params: {
    apiKey: string;
  }): Promise<{ workflowId: string; sessionId: string }> {
    const { apiKey } = params;
    
    // Validate API key
    const user = await this.validateApiKey(apiKey);
    
    // Generate session ID
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    
    // Trigger workflow
    const workflowId = await this.runWorkflow('CREATE_SESSION', {
      userId: user.id,
      sessionId,
    });
    
    return { workflowId, sessionId };
  }

  // TODO: Add getWorkflowStatus() @callable method
  // Need to figure out how to query Workflow status from Agent

  /**
   * Deduct credits from user account.
   * Called by workflows after task execution.
   */
  @callable({ description: 'Deduct credits from user account' })
  async deductCredits(params: {
    userId: string;
    credits: number;
  }): Promise<{ success: boolean; newBalance: number }> {
    const { userId, credits } = params;
    
    // Update user credit balance in D1
    const db = drizzle(this.env.DB);
    
    // TODO: Implement atomic credit deduction
    // For now, return mock
    return {
      success: true,
      newBalance: 9500, // Mock balance
    };
  }

  /**
   * Validate API key and return user info.
   * 
   * @private Internal method - not exposed as @callable
   */
  private async validateApiKey(key: string): Promise<{ id: string; userId: string }> {
    if (!key) {
      throw new Error('API key required');
    }
    
    // Hash the key
    const hashedKey = await this.hashApiKey(key);
    
    // Query database
    const db = drizzle(this.env.DB);
    const results = await db
      .select({
        id: apikey.id,
        userId: apikey.userId,
        expiresAt: apikey.expiresAt,
      })
      .from(apikey)
      .where(eq(apikey.key, hashedKey))
      .limit(1);
    
    if (results.length === 0) {
      throw new Error('Invalid API key');
    }
    
    const key_record = results[0];
    
    // Check expiration
    if (key_record.expiresAt && new Date(key_record.expiresAt) < new Date()) {
      throw new Error('API key expired');
    }
    
    return {
      id: key_record.id,
      userId: key_record.userId,
    };
  }

  /**
   * Hash API key for database lookup.
   */
  // Base64url encode (RFC 4648 §5, no padding)
  private base64UrlEncode(data: Uint8Array): string {
    let base64 = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    for (let i = 0; i < data.length; i += 3) {
      const b1 = data[i];
      const b2 = data[i + 1] ?? 0;
      const b3 = data[i + 2] ?? 0;
      base64 += chars[b1 >> 2];
      base64 += chars[((b1 & 3) << 4) | (b2 >> 4)];
      if (i + 1 < data.length) base64 += chars[((b2 & 15) << 2) | (b3 >> 6)];
      if (i + 2 < data.length) base64 += chars[b3 & 63];
    }
    return base64.replace(/\+/g, '-').replace(/\//g, '_');
  }

  // Hash API key using same algorithm as better-auth (SHA-256 + base64url)
  private async hashApiKey(key: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(hashBuffer));
  }

  /**
   * REST API wrapper.
   * 
   * SECONDARY interface for external agents using curl/HTTP.
   * Extracts API key from header and routes to @callable methods.
   */
  async fetch(request: Request): Promise<Response> {
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
    
    try {
      // Extract API key from header
      const apiKey = request.headers.get('x-api-key');
      
      if (!apiKey) {
        return Response.json(
          { error: 'Missing x-api-key header' },
          { status: 401 }
        );
      }
      
      // Route to @callable methods
      
      // GET /api/orchestrator - health check
      if (request.method === 'GET' && url.pathname === '/api/orchestrator') {
        return Response.json({
          status: 'ok',
          version: '2.0-agents-sdk',
          interfaces: ['REST', 'RPC', 'WebSocket'],
        });
      }
      
      // POST /api/orchestrator - execute task
      if (request.method === 'POST' && url.pathname === '/api/orchestrator') {
        const body = await request.json() as { sessionId?: string; task?: string };
        
        if (!body.sessionId) {
          return Response.json({ error: 'Missing sessionId' }, { status: 400 });
        }
        
        if (!body.task) {
          return Response.json({ error: 'Missing task' }, { status: 400 });
        }
        
        // Call @callable method
        const result = await this.executeTask({
          sessionId: body.sessionId,
          task: body.task,
          apiKey,
        });
        
        return Response.json({ success: true, ...result });
      }
      
      // POST /api/orchestrator/session - create session
      if (request.method === 'POST' && url.pathname === '/api/orchestrator/session') {
        // Call @callable method
        const result = await this.createSession({ apiKey });
        return Response.json({ success: true, ...result });
      }
      
      // TODO: GET /api/workflow/:id/status - get workflow status
      // Need to implement workflow status querying
      
      // Let parent class handle WebSocket connections and other routes
      return super.fetch(request);
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return Response.json(
        { error: message },
        { status: error instanceof Error && message.includes('API key') ? 401 : 500 }
      );
    }
  }

  /**
   * Called when a workflow reports progress.
   * Broadcasts to all connected WebSocket clients.
   */
  async onWorkflowProgress(
    name: string,
    id: string,
    progress: { type: string; data: unknown }
  ): Promise<void> {
    // Broadcast progress to all connected clients via WebSocket
    this.broadcast(JSON.stringify({
      type: 'workflow-progress',
      workflowName: name,
      workflowId: id,
      progressType: progress.type,
      progressData: progress.data,
    }));
  }
}
