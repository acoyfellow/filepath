import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { initAuth } from '$lib/auth';
import { DEFAULT_MODEL_FULL } from '$lib/config';

/**
 * GET /api/openapi.json - Returns the complete OpenAPI specification
 * 
 * This includes:
 * - Better Auth endpoints (auth, api keys, sessions)
 * - filepath API endpoints (sessions, nodes, agents)
 * 
 * For interactive docs, visit /api/auth/reference (Scalar UI)
 */
export const GET: RequestHandler = async ({ platform, url }) => {
  const db = platform?.env?.DB;
  const baseURL = url.origin;
  
  if (!db) {
    return new Response(JSON.stringify({ error: 'Database not available' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const auth = initAuth(db, platform?.env as Record<string, unknown>, baseURL);
    
    // Get Better Auth's OpenAPI schema
    // @ts-expect-error - generateOpenAPISchema exists at runtime
    const authSchema = auth.api.generateOpenAPISchema ? await auth.api.generateOpenAPISchema() : null;
    
    // filepath-specific API endpoints
    const filepathPaths = {
      // Sessions
      '/api/sessions': {
        get: {
          tags: ['Sessions'],
          summary: 'List all sessions',
          description: 'Get all agent sessions for the authenticated user',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'List of sessions',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      sessions: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Session' }
                      }
                    }
                  }
                }
              }
            },
            '401': { description: 'Unauthorized' }
          }
        },
        post: {
          tags: ['Sessions'],
          summary: 'Create a new session',
          description: 'Create a new agent session',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Session name' },
                    gitRepoUrl: { type: 'string', description: 'Optional git repository URL' }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Session created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' }
                    }
                  }
                }
              }
            },
            '401': { description: 'Unauthorized' }
          }
        }
      },
      '/api/sessions/{id}': {
        get: {
          tags: ['Sessions'],
          summary: 'Get session details',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            '200': { description: 'Session details' },
            '401': { description: 'Unauthorized' },
            '404': { description: 'Not found' }
          }
        }
      },
      '/api/sessions/{id}/nodes': {
        get: {
          tags: ['Nodes'],
          summary: 'List all nodes in a session',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            '200': { description: 'List of nodes' },
            '401': { description: 'Unauthorized' }
          }
        },
        post: {
          tags: ['Nodes'],
          summary: 'Spawn a new agent node',
          description: 'Create a new agent in the session',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'agentType', 'model'],
                  properties: {
                    name: { type: 'string', description: 'Agent name' },
                    agentType: { 
                      type: 'string',
                      description: 'Harness ID from /api/harnesses'
                    },
                    model: { type: 'string', description: `LLM model (e.g., ${DEFAULT_MODEL_FULL})` },
                    parentId: { type: 'string', description: 'Parent node ID for nested agents' },
                    config: { type: 'object', description: 'Agent configuration' },
                    apiKey: { type: 'string', description: 'Optional per-session API key' }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Agent created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' }
                    }
                  }
                }
              }
            },
            '401': { description: 'Unauthorized' },
            '400': { description: 'Bad request' }
          }
        }
      },
      '/api/sessions/{id}/tree': {
        get: {
          tags: ['Sessions'],
          summary: 'Get session tree structure',
          description: 'Get hierarchical tree of all nodes in session',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            '200': { description: 'Tree structure' },
            '401': { description: 'Unauthorized' }
          }
        }
      },
      '/api/models': {
        get: {
          tags: ['Models'],
          summary: 'List available models',
          description: 'Get live LLM models from the configured routers',
          responses: {
            '200': {
              description: 'List of models',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      models: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                            provider: { type: 'string' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/user/keys': {
        get: {
          tags: ['User'],
          summary: 'Get user router keys',
          description: 'Retrieve masked router keys by provider',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'User keys',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      keys: {
                        type: 'object',
                        properties: {
                          openrouter: { type: 'string', nullable: true },
                          zen: { type: 'string', nullable: true }
                        }
                      }
                    }
                  }
                }
              }
            },
            '401': { description: 'Unauthorized' }
          }
        },
        post: {
          tags: ['User'],
          summary: 'Save provider router key',
          description: 'Validate and store an encrypted router key for the selected provider',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['provider', 'key'],
                  properties: {
                    provider: { type: 'string', enum: ['openrouter', 'zen'] },
                    key: { type: 'string', description: 'API key (set to null to delete)' }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Key saved' },
            '400': { description: 'Validation failed' },
            '401': { description: 'Unauthorized' }
          }
        }
      },
      '/api/config': {
        get: {
          tags: ['Config'],
          summary: 'Get public config',
          description: 'Get environment-dependent configuration including WebSocket URL',
          responses: {
            '200': {
              description: 'Configuration',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      workerUrl: { type: 'string', description: 'WebSocket endpoint URL' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/harnesses': {
        get: {
          tags: ['Harnesses'],
          summary: 'List available harnesses',
          description: 'Get registered agent harnesses from the database-backed harness registry',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'List of harnesses' },
            '401': { description: 'Unauthorized' }
          }
        },
        post: {
          tags: ['Harnesses'],
          summary: 'Create a harness',
          description: 'Admin-only. Add a harness to the registry.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['id', 'name', 'description', 'adapter', 'defaultModel', 'icon'],
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    adapter: { type: 'string' },
                    entryCommand: { type: 'string' },
                    defaultModel: { type: 'string' },
                    icon: { type: 'string' },
                    enabled: { type: 'boolean' },
                    config: { type: 'object' }
                  }
                }
              }
            }
          },
          responses: {
            '201': { description: 'Harness created' },
            '401': { description: 'Unauthorized' },
            '403': { description: 'Admin only' },
            '409': { description: 'Harness already exists' }
          }
        }
      },
      '/api/harnesses/{id}': {
        patch: {
          tags: ['Harnesses'],
          summary: 'Update a harness',
          description: 'Admin-only. Update a registered harness.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'description', 'adapter', 'defaultModel', 'icon'],
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    adapter: { type: 'string' },
                    entryCommand: { type: 'string' },
                    defaultModel: { type: 'string' },
                    icon: { type: 'string' },
                    enabled: { type: 'boolean' },
                    config: { type: 'object' }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Harness updated' },
            '401': { description: 'Unauthorized' },
            '403': { description: 'Admin only' },
            '404': { description: 'Harness not found' }
          }
        },
        delete: {
          tags: ['Harnesses'],
          summary: 'Delete a harness',
          description: 'Admin-only. Delete a registered harness when it is not in use.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            '200': { description: 'Harness deleted' },
            '401': { description: 'Unauthorized' },
            '403': { description: 'Admin only' },
            '404': { description: 'Harness not found' },
            '409': { description: 'Harness is in use' }
          }
        }
      }
    };

    // WebSocket endpoint (documented but not a REST endpoint)
    const websocketInfo = {
      description: 'WebSocket Chat Endpoint',
      url: 'wss://api.myfilepath.com/agents/chat-agent/{nodeId}',
      protocol: 'ws',
      parameters: [
        { name: 'nodeId', description: 'Agent node ID', in: 'path', required: true }
      ],
      messages: {
        send: {
          description: 'Send a message to the agent',
          schema: {
            type: 'object',
            required: ['type', 'content'],
            properties: {
              type: { type: 'string', enum: ['message'] },
              content: { type: 'string' },
              nodeId: { type: 'string' },
              sessionId: { type: 'string' }
            }
          }
        },
        receive: {
          description: 'Receive streaming response',
          schema: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['text', 'tool', 'status', 'done'] },
              content: { type: 'string' }
            }
          }
        }
      }
    };

    // Combine schemas
    const fullSchema = {
      openapi: '3.0.0',
      info: {
        title: 'filepath API',
        description: 'API for agent orchestration. Create sessions, spawn agents, and chat via WebSocket.',
        version: '1.0.0',
        contact: {
          name: 'filepath',
          url: 'https://github.com/acoyfellow/filepath'
        }
      },
      servers: [
        { url: baseURL, description: 'Current server' }
      ],
      paths: {
        ...(authSchema?.paths || {}),
        ...filepathPaths
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT session token from login'
          },
          apiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'x-api-key',
            description: 'API key for programmatic access'
          }
        },
        schemas: {
          Session: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              status: { type: 'string', enum: ['draft', 'active', 'completed'] },
              createdAt: { type: 'number' },
              updatedAt: { type: 'number' },
              nodeCount: { type: 'number' }
            }
          },
          Node: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              agentType: { type: 'string' },
              model: { type: 'string' },
              status: { type: 'string', enum: ['idle', 'running', 'error', 'done'] },
              parentId: { type: 'string', nullable: true }
            }
          },
          ...(authSchema?.components?.schemas || {})
        }
      },
      externalDocs: {
        description: 'Interactive API documentation (Scalar UI)',
        url: '/api/auth/reference'
      },
      'x-websocket': websocketInfo
    };

    return json(fullSchema);
  } catch (err) {
    console.error('OpenAPI generation error:', err);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate OpenAPI spec',
      details: String(err)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
