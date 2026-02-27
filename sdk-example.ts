/**
 * filepath TypeScript SDK
 * 
 * Auto-generated types + hand-written convenience methods.
 * This is what a proper SDK would look like vs raw fetch calls.
 */

import type { AgentType, AgentNode, AgentSession, SpawnRequest } from './types';

// =============================================================================
// TYPES (from your schema)
// =============================================================================

export interface Session {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'completed';
  gitRepoUrl: string | null;
  createdAt: number;
  updatedAt: number;
  nodeCount?: number;
}

export interface Node {
  id: string;
  sessionId: string;
  parentId: string | null;
  name: string;
  agentType: AgentType;
  model: string;
  status: 'idle' | 'running' | 'error' | 'done';
  config: Record<string, unknown>;
  sortOrder: number;
  createdAt: number;
}

export interface UserKeys {
  openrouter: string | null; // masked key
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
}

// =============================================================================
// SDK CLIENT
// =============================================================================

export class FilepathClient {
  private baseURL: string;
  private wsUrl: string;
  
  constructor(baseURL: string = 'https://myfilepath.com') {
    this.baseURL = baseURL.replace(/\/$/, '');
    this.wsUrl = baseURL.replace(/^http/, 'ws');
  }
  
  // Auth: handled by cookies automatically
  // In browser, fetch includes cookies by default
  
  // ==========================================================================
  // SESSIONS
  // ==========================================================================
  
  /**
   * List all sessions for the current user
   * 
   * LIBRARY WAY:
   * ```ts
   * const client = new FilepathClient();
   * const sessions = await client.sessions.list();
   * ```
   * 
   * RAW REST WAY:
   * ```ts
   * const res = await fetch('/api/sessions', {
   *   credentials: 'include'
   * });
   * const { sessions } = await res.json();
   * ```
   */
  sessions = {
    list: async (): Promise<Session[]> => {
      const res = await fetch(`${this.baseURL}/api/sessions`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`Failed to list sessions: ${res.status}`);
      const data = await res.json();
      return data.sessions;
    },
    
    create: async (name: string, gitRepoUrl?: string): Promise<Session> => {
      const res = await fetch(`${this.baseURL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, gitRepoUrl })
      });
      if (!res.ok) throw new Error(`Failed to create session: ${res.status}`);
      return res.json();
    },
    
    get: async (sessionId: string): Promise<Session & { tree: Node[] }> => {
      const res = await fetch(`${this.baseURL}/api/sessions/${sessionId}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`Failed to get session: ${res.status}`);
      return res.json();
    },
    
    delete: async (sessionId: string): Promise<void> => {
      const res = await fetch(`${this.baseURL}/api/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`Failed to delete session: ${res.status}`);
    },
    
    /**
     * Get tree structure with nested children
     */
    tree: async (sessionId: string): Promise<Node[]> => {
      const res = await fetch(`${this.baseURL}/api/sessions/${sessionId}/tree`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`Failed to get tree: ${res.status}`);
      const data = await res.json();
      return data.tree;
    }
  };
  
  // ==========================================================================
  // NODES (Agents)
  // ==========================================================================
  
  /**
   * Spawn and manage agent nodes
   * 
   * LIBRARY WAY:
   * ```ts
   * const node = await client.nodes.spawn(sessionId, {
   *   name: 'My Researcher',
   *   agentType: 'pi',
   *   model: 'anthropic/claude-sonnet-4'
   * });
   * ```
   * 
   * RAW REST WAY:
   * ```ts
   * const res = await fetch(`/api/sessions/${sessionId}/nodes`, {
   *   method: 'POST',
   *   headers: { 'Content-Type': 'application/json' },
   *   credentials: 'include',
   *   body: JSON.stringify({
   *     name: 'My Researcher',
   *     agentType: 'pi',
   *     model: 'anthropic/claude-sonnet-4'
   *   })
   * });
   * const node = await res.json();
   * ```
   */
  nodes = {
    list: async (sessionId: string): Promise<Node[]> => {
      const res = await fetch(`${this.baseURL}/api/sessions/${sessionId}/nodes`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`Failed to list nodes: ${res.status}`);
      const data = await res.json();
      return data.nodes;
    },
    
    spawn: async (
      sessionId: string, 
      request: Omit<SpawnRequest, 'sessionId'>
    ): Promise<Node> => {
      const res = await fetch(`${this.baseURL}/api/sessions/${sessionId}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(request)
      });
      if (!res.ok) throw new Error(`Failed to spawn node: ${res.status}`);
      return res.json();
    },
    
    get: async (sessionId: string, nodeId: string): Promise<Node> => {
      const res = await fetch(`${this.baseURL}/api/sessions/${sessionId}/nodes/${nodeId}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`Failed to get node: ${res.status}`);
      return res.json();
    },
    
    update: async (
      sessionId: string, 
      nodeId: string, 
      updates: Partial<Pick<Node, 'name' | 'config'>>
    ): Promise<Node> => {
      const res = await fetch(`${this.baseURL}/api/sessions/${sessionId}/nodes/${nodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error(`Failed to update node: ${res.status}`);
      return res.json();
    },
    
    delete: async (sessionId: string, nodeId: string): Promise<void> => {
      const res = await fetch(`${this.baseURL}/api/sessions/${sessionId}/nodes/${nodeId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`Failed to delete node: ${res.status}`);
    }
  };
  
  // ==========================================================================
  // USER / KEYS
  // ==========================================================================
  
  /**
   * Manage your API keys
   * 
   * LIBRARY WAY:
   * ```ts
   * await client.user.setKey('openrouter', 'sk-or-v1-...');
   * const keys = await client.user.getKeys(); // { openrouter: "sk-or...***" }
   * ```
   * 
   * RAW REST WAY:
   * ```ts
   * await fetch('/api/user/keys', {
   *   method: 'POST',
   *   headers: { 'Content-Type': 'application/json' },
   *   credentials: 'include',
   *   body: JSON.stringify({ provider: 'openrouter', key: 'sk-or-v1-...' })
   * });
   * ```
   */
  user = {
    getKeys: async (): Promise<UserKeys> => {
      const res = await fetch(`${this.baseURL}/api/user/keys`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`Failed to get keys: ${res.status}`);
      return res.json();
    },
    
    setKey: async (provider: 'openrouter', key: string): Promise<void> => {
      const res = await fetch(`${this.baseURL}/api/user/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider, key })
      });
      if (!res.ok) throw new Error(`Failed to set key: ${res.status}`);
    },
    
    deleteKey: async (provider: 'openrouter'): Promise<void> => {
      const res = await fetch(`${this.baseURL}/api/user/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider, key: null })
      });
      if (!res.ok) throw new Error(`Failed to delete key: ${res.status}`);
    }
  };
  
  // ==========================================================================
  // MODELS
  // ==========================================================================
  
  /**
   * List available LLM models
   * 
   * LIBRARY WAY:
   * ```ts
   * const models = await client.models.list();
   * const sonnet = models.find(m => m.id.includes('sonnet'));
   * ```
   * 
   * RAW REST WAY:
   * ```ts
   * const res = await fetch('/api/models');
   * const { models } = await res.json();
   * ```
   */
  models = {
    list: async (): Promise<ModelInfo[]> => {
      const res = await fetch(`${this.baseURL}/api/models`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`Failed to list models: ${res.status}`);
      const data = await res.json();
      return data.models;
    }
  };
  
  // ==========================================================================
  // WEBSOCKET (Chat)
  // ==========================================================================
  
  /**
   * Connect to an agent via WebSocket for real-time chat
   * 
   * LIBRARY WAY:
   * ```ts
   * const chat = client.chat.connect(nodeId, {
   *   onMessage: (msg) => console.log(msg.content),
   *   onStateChange: (state) => console.log(state)
   * });
   * 
   * chat.send('Hello agent!');
   * chat.close();
   * ```
   * 
   * RAW REST WAY:
   * ```ts
   * const ws = new WebSocket(`wss://api.myfilepath.com/agents/chat-agent/${nodeId}`);
   * ws.onmessage = (e) => {
   *   const msg = JSON.parse(e.data);
   *   console.log(msg);
   * };
   * ws.send(JSON.stringify({ type: 'message', content: 'Hello!' }));
   * ```
   */
  chat = {
    connect: (
      nodeId: string,
      callbacks: {
        onMessage: (msg: { type: string; content?: string; role?: string }) => void;
        onStateChange?: (state: 'connecting' | 'open' | 'closed' | 'error') => void;
      }
    ) => {
      const url = `${this.wsUrl}/agents/chat-agent/${nodeId}`;
      const ws = new WebSocket(url);
      
      ws.onopen = () => callbacks.onStateChange?.('open');
      ws.onclose = () => callbacks.onStateChange?.('closed');
      ws.onerror = () => callbacks.onStateChange?.('error');
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          callbacks.onMessage(msg);
        } catch {
          console.error('Failed to parse message:', e.data);
        }
      };
      
      return {
        send: (content: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'message', content }));
          }
        },
        close: () => ws.close()
      };
    }
  };
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

/**
 * Quick session creation with first agent spawn
 * 
 * LIBRARY WAY:
   * ```ts
 * import { quickstart } from '@filepath/sdk';
 * 
 * const { session, node } = await quickstart({
 *   sessionName: 'API Project',
 *   agentName: 'Researcher',
 *   agentType: 'pi',
 *   task: 'Research this API for me'
 * });
 * ```
 */
export async function quickstart(options: {
  sessionName: string;
  agentName: string;
  agentType: AgentType;
  model?: string;
  task?: string;
  baseURL?: string;
}): Promise<{ session: Session; node: Node }> {
  const client = new FilepathClient(options.baseURL);
  
  // Create session
  const session = await client.sessions.create(options.sessionName);
  
  // Spawn first agent
  const node = await client.nodes.spawn(session.id, {
    name: options.agentName,
    agentType: options.agentType,
    model: options.model || 'anthropic/claude-sonnet-4'
  });
  
  // Send initial task if provided
  if (options.task) {
    const chat = client.chat.connect(node.id, {
      onMessage: () => {} // handle in your UI
    });
    setTimeout(() => chat.send(options.task!), 500);
  }
  
  return { session, node };
}

// Default export
export default FilepathClient;
