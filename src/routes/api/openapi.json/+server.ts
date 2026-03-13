import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
  const origin = url.origin;

  return json({
    openapi: "3.1.0",
    info: {
      title: "filepath API",
      version: "1.0.0",
      description:
        "API for personal Cloudflare-hosted workspaces and bounded background agents.",
    },
    servers: [{ url: origin }],
    tags: [{ name: "Workspaces" }, { name: "Agents" }],
    components: {
      securitySchemes: {
        betterAuthSession: {
          type: "apiKey",
          in: "cookie",
          name: "better-auth.session_token",
          description:
            "Authenticate with a Better Auth session cookie created through the dashboard sign-in flow.",
        },
      },
      schemas: {
        Workspace: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            status: { type: "string" },
            gitRepoUrl: { type: ["string", "null"] },
            agentCount: { type: "integer" },
            createdAt: { type: "integer" },
            updatedAt: { type: "integer" },
          },
          required: ["id", "name", "status", "createdAt", "updatedAt"],
        },
        AgentScope: {
          type: "object",
          properties: {
            allowedPaths: { type: "array", items: { type: "string" } },
            forbiddenPaths: { type: "array", items: { type: "string" } },
            toolPermissions: {
              type: "array",
              items: {
                type: "string",
                enum: ["inspect", "search", "run", "write", "commit"],
              },
            },
            writableRoot: { type: ["string", "null"] },
          },
          required: ["allowedPaths", "forbiddenPaths", "toolPermissions", "writableRoot"],
        },
        Agent: {
          allOf: [
            { $ref: "#/components/schemas/AgentScope" },
            {
              type: "object",
              properties: {
                id: { type: "string" },
                workspaceId: { type: "string" },
                name: { type: "string" },
                harnessId: { type: "string" },
                model: { type: "string" },
                status: { type: "string" },
                tokens: { type: "integer" },
                containerId: { type: ["string", "null"] },
                createdAt: { type: "integer" },
                updatedAt: { type: "integer" },
              },
              required: [
                "id",
                "workspaceId",
                "name",
                "harnessId",
                "model",
                "status",
                "tokens",
                "createdAt",
                "updatedAt",
              ],
            },
          ],
        },
        TaskRequest: {
          type: "object",
          properties: {
            content: { type: "string" },
          },
          required: ["content"],
        },
        AgentResult: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["success", "error", "aborted", "policy_error"],
            },
            summary: { type: "string" },
            commands: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  command: { type: "string" },
                  exitCode: { type: ["integer", "null"] },
                },
                required: ["command", "exitCode"],
              },
            },
            filesTouched: { type: "array", items: { type: "string" } },
            violations: { type: "array", items: { type: "string" } },
            diffSummary: { type: ["string", "null"] },
            commit: {
              oneOf: [
                { type: "null" },
                {
                  type: "object",
                  properties: {
                    sha: { type: "string" },
                    message: { type: "string" },
                  },
                  required: ["sha", "message"],
                },
              ],
            },
            startedAt: { type: "integer" },
            finishedAt: { type: "integer" },
          },
          required: [
            "status",
            "summary",
            "commands",
            "filesTouched",
            "violations",
            "startedAt",
            "finishedAt",
          ],
        },
      },
    },
    security: [{ betterAuthSession: [] }],
    paths: {
      "/api/workspaces": {
        get: {
          tags: ["Workspaces"],
          summary: "List workspaces",
          responses: {
            "200": {
              description: "Workspace list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      workspaces: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Workspace" },
                      },
                    },
                    required: ["workspaces"],
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ["Workspaces"],
          summary: "Create workspace",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    gitRepoUrl: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Workspace created",
            },
          },
        },
      },
      "/api/workspaces/{id}": {
        get: {
          tags: ["Workspaces"],
          summary: "Get workspace with agents",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "Workspace details",
            },
          },
        },
        patch: {
          tags: ["Workspaces"],
          summary: "Update workspace",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Workspace updated" } },
        },
        delete: {
          tags: ["Workspaces"],
          summary: "Delete workspace",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Workspace deleted" } },
        },
      },
      "/api/workspaces/{id}/agents": {
        get: {
          tags: ["Agents"],
          summary: "List agents in a workspace",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "Agent list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      agents: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Agent" },
                      },
                    },
                    required: ["agents"],
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ["Agents"],
          summary: "Create agent",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/AgentScope" },
                    {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        harnessId: { type: "string" },
                        model: { type: "string" },
                      },
                      required: ["name", "harnessId", "model"],
                    },
                  ],
                },
              },
            },
          },
          responses: { "201": { description: "Agent created" } },
        },
      },
      "/api/workspaces/{id}/agents/{agentId}": {
        get: {
          tags: ["Agents"],
          summary: "Get agent",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
            { name: "agentId", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "Agent details" } },
        },
        patch: {
          tags: ["Agents"],
          summary: "Update agent",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
            { name: "agentId", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "Agent updated" } },
        },
        delete: {
          tags: ["Agents"],
          summary: "Delete agent",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
            { name: "agentId", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "Agent deleted" } },
        },
      },
      "/api/workspaces/{id}/agents/{agentId}/tasks": {
        post: {
          tags: ["Agents"],
          summary: "Run a task on an agent",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
            { name: "agentId", in: "path", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TaskRequest" },
              },
            },
          },
          responses: {
            "202": {
              description: "Task accepted",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      result: { $ref: "#/components/schemas/AgentResult" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/workspaces/{id}/agents/{agentId}/cancel": {
        post: {
          tags: ["Agents"],
          summary: "Cancel the active agent task",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
            { name: "agentId", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Cancellation result",
            },
          },
        },
      },
    },
  });
};
