import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { initAuth } from '$lib/auth';

/**
 * MCP (Model Context Protocol) Server Endpoint
 * 
 * This implements the MCP specification to allow AI agents to:
 * - Discover filepath tools
 * - Invoke tools (spawn agents, create sessions, etc.)
 * - Access resources (session data, chat history)
 * 
 * Protocol: JSON-RPC 2.0 over HTTP POST
 * Docs: https://modelcontextprotocol.io/
 */

interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// Tool definitions
const TOOLS = [
  {
    name: 'sessions_list',
    description: 'List all agent sessions for the authenticated user',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'session_create',
    description: 'Create a new agent session (project workspace)',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Session name' },
        gitRepoUrl: { type: 'string', description: 'Optional git repository to clone' }
      },
      required: ['name']
    }
  },
  {
    name: 'session_get',
    description: 'Get session details including the agent tree structure',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' }
      },
      required: ['sessionId']
    }
  },
  {
    name: 'session_delete',
    description: 'Delete a session and all its agents',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID to delete' }
      },
      required: ['sessionId']
    }
  },
  {
    name: 'nodes_list',
    description: 'List all agents (nodes) in a session',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' }
      },
      required: ['sessionId']
    }
  },
  {
    name: 'node_spawn',
    description: 'Spawn a new agent in a session',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        name: { type: 'string', description: 'Agent name' },
        agentType: { 
          type: 'string', 
          enum: ['shelley', 'pi', 'claude-code', 'codex', 'cursor', 'amp', 'opencode', 'custom'],
          description: 'Type of agent to spawn'
        },
        model: { type: 'string', description: 'LLM model (e.g., anthropic/claude-sonnet-4)' },
        parentId: { type: 'string', description: 'Parent node ID for nested agents' },
        task: { type: 'string', description: 'Initial task/message for the agent' }
      },
      required: ['sessionId', 'name', 'agentType', 'model']
    }
  },
  {
    name: 'node_send_message',
    description: 'Send a message to an agent (via REST, one-shot)',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        nodeId: { type: 'string', description: 'Agent node ID' },
        message: { type: 'string', description: 'Message to send' }
      },
      required: ['sessionId', 'nodeId', 'message']
    }
  },
  {
    name: 'node_delete',
    description: 'Delete an agent node',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        nodeId: { type: 'string', description: 'Node ID to delete' }
      },
      required: ['sessionId', 'nodeId']
    }
  },
  {
    name: 'models_list',
    description: 'List available LLM models',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

// Resource definitions
const RESOURCES = [
  {
    uri: 'filepath://sessions',
    name: 'All Sessions',
    description: 'List of all agent sessions',
    mimeType: 'application/json'
  },
  {
    uri: 'filepath://models',
    name: 'Available Models',
    description: 'List of available LLM models',
    mimeType: 'application/json'
  }
];

export const POST: RequestHandler = async ({ request, locals, platform, url }) => {
  // Auth check
  if (!locals.user) {
    return json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32001, message: 'Unauthorized' }
    }, { status: 401 });
  }

  let rpcRequest: MCPRequest;
  
  try {
    rpcRequest = await request.json();
  } catch {
    return json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error: Invalid JSON' }
    }, { status: 400 });
  }

  const { id, method, params = {} } = rpcRequest;
  const baseURL = url.origin;

  // Handle initialization
  if (method === 'initialize') {
    return json({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: false },
          resources: { listChanged: false, subscribe: false }
        },
        serverInfo: {
          name: 'filepath-mcp',
          version: '1.0.0'
        }
      }
    });
  }

  // Handle tool discovery
  if (method === 'tools/list') {
    return json({
      jsonrpc: '2.0',
      id,
      result: { tools: TOOLS }
    });
  }

  // Handle resource discovery
  if (method === 'resources/list') {
    return json({
      jsonrpc: '2.0',
      id,
      result: { resources: RESOURCES }
    });
  }

  // Handle resource read
  if (method === 'resources/read') {
    const uri = params.uri as string;
    
    if (uri === 'filepath://models') {
      const res = await fetch(`${baseURL}/api/models`, {
        credentials: 'include'
      });
      const data = await res.json();
      return json({
        jsonrpc: '2.0',
        id,
        result: {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(data, null, 2)
          }]
        }
      });
    }
    
    return json({
      jsonrpc: '2.0',
      id,
      error: { code: -32002, message: 'Resource not found' }
    });
  }

  // Handle tool invocation
  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    
    try {
      let result: unknown;

      switch (name) {
        case 'sessions_list': {
          const res = await fetch(`${baseURL}/api/sessions`, {
            credentials: 'include'
          });
          result = await res.json();
          break;
        }

        case 'session_create': {
          const res = await fetch(`${baseURL}/api/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              name: args.name,
              gitRepoUrl: args.gitRepoUrl
            })
          });
          result = await res.json();
          break;
        }

        case 'session_get': {
          const res = await fetch(`${baseURL}/api/sessions/${args.sessionId}`, {
            credentials: 'include'
          });
          result = await res.json();
          break;
        }

        case 'session_delete': {
          const res = await fetch(`${baseURL}/api/sessions/${args.sessionId}`, {
            method: 'DELETE',
            credentials: 'include'
          });
          result = res.ok ? { success: true } : { error: 'Failed to delete' };
          break;
        }

        case 'nodes_list': {
          const res = await fetch(`${baseURL}/api/sessions/${args.sessionId}/nodes`, {
            credentials: 'include'
          });
          result = await res.json();
          break;
        }

        case 'node_spawn': {
          const res = await fetch(`${baseURL}/api/sessions/${args.sessionId}/nodes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              name: args.name,
              agentType: args.agentType,
              model: args.model,
              parentId: args.parentId
            })
          });
          result = await res.json();
          break;
        }

        case 'node_delete': {
          const res = await fetch(`${baseURL}/api/sessions/${args.sessionId}/nodes/${args.nodeId}`, {
            method: 'DELETE',
            credentials: 'include'
          });
          result = res.ok ? { success: true } : { error: 'Failed to delete' };
          break;
        }

        case 'models_list': {
          const res = await fetch(`${baseURL}/api/models`, {
            credentials: 'include'
          });
          result = await res.json();
          break;
        }

        default:
          return json({
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Tool not found: ${name}` }
          });
      }

      return json({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        }
      });

    } catch (error) {
      return json({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: `Internal error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      });
    }
  }

  // Method not found
  return json({
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Method not found: ${method}` }
  });
};
