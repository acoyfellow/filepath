/**
 * Worker entry point.
 *
 * Exports:
 * - ChatAgent DO (chat + LLM, SQLite persistence)
 * - TaskAgent DO (compatibility binding that fails closed)
 * - SessionEventBusV2 (session-scoped event bus)
 * - Sandbox (re-export for Container binding)
 *
 * Routes:
 * - /agents/* → Agent SDK (WebSocket connections to ChatAgent)
 * - session event routes for session-scoped websocket fan-out
 * - internal session event fan-out routes
 * - Everything else → 404
 */

import { routeAgentRequest } from 'agents';
import { getSandbox, proxyToSandbox } from '@cloudflare/sandbox';
import { ChatAgent } from '../src/agent/chat-agent';
import { TaskAgent } from '../src/agent/index';
import {
  ensureTerminalInContainer,
  exportArtifactFromContainer,
  importArtifactToContainer,
  cloneRepo,
  type ContainerEnv,
} from '../src/lib/agents/container';
import { SessionEventBusV2, Sandbox } from './index';
import type { Env } from '../src/types';

// Export DO classes (Alchemy needs these)
export { ChatAgent };
export { TaskAgent };
export { SessionEventBusV2 };
export { Sandbox };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const proxiedSandboxResponse = await proxyToSandbox(request as never, env as never);
    if (proxiedSandboxResponse) {
      return proxiedSandboxResponse;
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // /agents/* → Agent SDK handles WebSocket upgrade + routing
    if (url.pathname.startsWith('/agents/')) {
      const response = await routeAgentRequest(request, env, {
        cors: true,
      });
      if (response) return response;
    }

    // /api/config → return worker URL for frontend WebSocket connections
    if (url.pathname === '/api/config') {
      const workerUrl = env.API_WS_HOST
        ? `https://${env.API_WS_HOST}`
        : url.origin;
      return new Response(JSON.stringify({ workerUrl }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const sessionEventsMatch = url.pathname.match(/^\/session-events\/([^/]+)$/);
    if (sessionEventsMatch) {
      const [, sessionId] = sessionEventsMatch;
      const sessionNamespace = env.SESSION_DO as any;
      const stub = sessionNamespace.get(sessionNamespace.idFromName(sessionId));
      return stub.fetch('https://session/connect', {
        method: 'GET',
        headers: request.headers,
      });
    }

    const internalSessionEventMatch = url.pathname.match(/^\/internal\/sessions\/([^/]+)\/events$/);
    if (internalSessionEventMatch && request.method === 'POST') {
      const [, sessionId] = internalSessionEventMatch;
      const sessionNamespace = env.SESSION_DO as any;
      const stub = sessionNamespace.get(sessionNamespace.idFromName(sessionId));
      return stub.fetch('https://session/events', {
        method: 'POST',
        headers: {
          'Content-Type': request.headers.get('content-type') || 'application/json',
        },
        body: request.body,
      });
    }

    const internalArtifactMatch = url.pathname.match(/^\/internal\/sessions\/([^/]+)\/artifacts$/);
    if (internalArtifactMatch && request.method === 'GET') {
      const [, sessionId] = internalArtifactMatch;
      const artifacts = await env.DB.prepare(
        `SELECT id, session_id as sessionId, source_node_id as sourceNodeId, target_node_id as targetNodeId,
                source_path as sourcePath, target_path as targetPath, bucket_key as bucketKey,
                status, error_message as errorMessage, created_at as createdAt, updated_at as updatedAt
           FROM agent_artifact
          WHERE session_id = ?
          ORDER BY created_at DESC`,
      )
        .bind(sessionId)
        .all();

      return new Response(JSON.stringify({ artifacts: artifacts.results ?? [] }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (internalArtifactMatch && request.method === 'POST') {
      const [, sessionId] = internalArtifactMatch;
      const body = await request.json().catch(() => null) as
        | {
            sourceNodeId?: string;
            sourcePath?: string;
            targetNodeId?: string;
            targetPath?: string;
          }
        | null;

      if (!body?.sourceNodeId || !body?.sourcePath || !body?.targetNodeId || !body?.targetPath) {
        return new Response(
          JSON.stringify({ error: 'sourceNodeId, sourcePath, targetNodeId, and targetPath are required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }

      const getThread = async (nodeId: string) => {
        const row = await env.DB.prepare(
          `SELECT n.id, n.container_id as containerId, s.git_repo_url as gitRepoUrl
             FROM agent_node n
             JOIN agent_session s ON n.session_id = s.id
            WHERE n.id = ? AND n.session_id = ?`,
        )
          .bind(nodeId, sessionId)
          .first<{ id: string; containerId: string | null; gitRepoUrl: string | null }>();

        if (!row) {
          return null;
        }

        return row;
      };

      const ensureThreadRuntime = async (row: { id: string; containerId: string | null; gitRepoUrl: string | null }) => {
        if (row.containerId) {
          return { id: row.id, containerId: row.containerId };
        }

        const containerId = row.id;
        if (row.gitRepoUrl) {
          await cloneRepo(
            { Sandbox: env.Sandbox } as unknown as ContainerEnv,
            containerId,
            row.gitRepoUrl,
            '/workspace',
          );
        } else {
          const sandbox = getSandbox(env.Sandbox as never, containerId) as {
            mkdir(path: string, options?: { recursive?: boolean }): Promise<unknown>;
          };
          await sandbox.mkdir('/workspace', { recursive: true });
        }

        await env.DB.prepare(
          `UPDATE agent_node
              SET container_id = ?, updated_at = unixepoch('subsecond') * 1000
            WHERE id = ?`,
        )
          .bind(containerId, row.id)
          .run();

        return { id: row.id, containerId };
      };

      const sourceRow = await getThread(body.sourceNodeId);
      const targetRow = await getThread(body.targetNodeId);

      if (!sourceRow || !targetRow) {
        return new Response(JSON.stringify({ error: 'Source or target thread not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const artifactId = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO agent_artifact
          (id, session_id, source_node_id, target_node_id, source_path, target_path, bucket_key, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch('subsecond') * 1000, unixepoch('subsecond') * 1000)`,
      )
        .bind(
          artifactId,
          sessionId,
          sourceRow.id,
          targetRow.id,
          body.sourcePath,
          body.targetPath,
          '',
          'staged',
        )
        .run();

      const sessionNamespace = env.SESSION_DO as any;
      const stub = sessionNamespace.get(sessionNamespace.idFromName(sessionId));
      const broadcast = async (payload: Record<string, unknown>) =>
        stub.fetch('https://session/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

      await broadcast({
        type: 'artifact_event',
        action: 'artifact_staged',
        artifactId,
        sourceNodeId: sourceRow.id,
        targetNodeId: targetRow.id,
        sourcePath: body.sourcePath,
        targetPath: body.targetPath,
      });

      try {
        const sourceNode = await ensureThreadRuntime(sourceRow);
        const artifactEnv = {
          Sandbox: env.Sandbox,
          ARTIFACTS: env.ARTIFACTS,
        } as ContainerEnv & { ARTIFACTS: any };

        const { bucketKey } = await exportArtifactFromContainer(
          artifactEnv,
          sourceNode.containerId,
          sessionId,
          sourceNode.id,
          body.sourcePath,
        );

        const targetNode = await ensureThreadRuntime(targetRow);

        await env.DB.prepare(
          `UPDATE agent_artifact
             SET bucket_key = ?, updated_at = unixepoch('subsecond') * 1000
           WHERE id = ?`,
        )
          .bind(bucketKey, artifactId)
          .run();

        await importArtifactToContainer(
          artifactEnv,
          targetNode.containerId,
          bucketKey,
          body.targetPath,
        );

        await env.DB.prepare(
          `UPDATE agent_artifact
             SET status = ?, updated_at = unixepoch('subsecond') * 1000
           WHERE id = ?`,
        )
          .bind('delivered', artifactId)
          .run();

        await broadcast({
          type: 'artifact_event',
          action: 'artifact_delivered',
          artifactId,
          sourceNodeId: sourceRow.id,
          targetNodeId: targetRow.id,
          sourcePath: body.sourcePath,
          targetPath: body.targetPath,
        });

        const artifact = await env.DB.prepare(
          `SELECT id, session_id as sessionId, source_node_id as sourceNodeId, target_node_id as targetNodeId,
                  source_path as sourcePath, target_path as targetPath, bucket_key as bucketKey,
                  status, error_message as errorMessage, created_at as createdAt, updated_at as updatedAt
             FROM agent_artifact WHERE id = ?`,
        )
          .bind(artifactId)
          .first();

        return new Response(JSON.stringify({ artifact }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Artifact transfer failed';
        await env.DB.prepare(
          `UPDATE agent_artifact
             SET status = ?, error_message = ?, updated_at = unixepoch('subsecond') * 1000
           WHERE id = ?`,
        )
          .bind('failed', message, artifactId)
          .run();

        await broadcast({
          type: 'artifact_event',
          action: 'artifact_failed',
          artifactId,
          sourceNodeId: sourceRow.id,
          targetNodeId: targetRow.id,
          sourcePath: body.sourcePath,
          targetPath: body.targetPath,
          errorMessage: message,
        });

        return new Response(JSON.stringify({ error: message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const terminalMatch = url.pathname.match(
      /^\/terminal\/session\/([^/]+)\/node\/([^/]+)(?:\/(meta))?$/,
    );
    if (terminalMatch) {
      const [, sessionId, nodeId, metaRoute] = terminalMatch;
      const nodeRow = await env.DB.prepare(
        `SELECT container_id as containerId FROM agent_node WHERE id = ? AND session_id = ?`,
      )
        .bind(nodeId, sessionId)
        .first<{ containerId: string | null }>();

      if (!nodeRow) {
        return new Response('Thread not found', { status: 404 });
      }
      if (!nodeRow.containerId) {
        return new Response(
          JSON.stringify({ message: 'This thread has no live sandbox runtime yet.' }),
          {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      try {
        const host = request.headers.get('host') ?? url.host;
        const terminal = await ensureTerminalInContainer(
          { Sandbox: env.Sandbox as never },
          nodeRow.containerId,
          host,
        );
        if (metaRoute === 'meta') {
          return new Response(JSON.stringify({ ok: true, url: terminal.url }), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }

        return Response.redirect(terminal.url, 302);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Terminal is unavailable for this thread.';
        return new Response(JSON.stringify({ message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const processMatch = url.pathname.match(
      /^\/internal\/sessions\/([^/]+)\/nodes\/([^/]+)\/processes$/,
    );
    if (processMatch) {
      const [, sessionId, nodeId] = processMatch;
      const nodeRow = await env.DB.prepare(
        `SELECT container_id as containerId, name FROM agent_node WHERE id = ? AND session_id = ?`,
      )
        .bind(nodeId, sessionId)
        .first<{ containerId: string | null; name: string }>();

      if (!nodeRow) {
        return new Response('Thread not found', { status: 404 });
      }
      if (!nodeRow.containerId) {
        return new Response(JSON.stringify({ processes: [] }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const sandbox = getSandbox(env.Sandbox as never, nodeRow.containerId) as {
        listProcesses(): Promise<Array<{ id: string; command: string; status: string }>>;
      };

      const processes = await sandbox.listProcesses();
      const mappedProcesses = processes.map((process) => {
        const command = process.command.toLowerCase();
        const kind =
          command.includes('ttyd')
            ? 'terminal'
            : command.includes('bash') || command.includes('sh ')
              ? 'shell'
              : command.includes('codex') ||
                  command.includes('claude') ||
                  command.includes('cursor') ||
                  command.includes('amp') ||
                  command.includes('shelley') ||
                  command.includes('pi')
                ? 'agent'
                : command.includes('node') ||
                    command.includes('python') ||
                    command.includes('npm')
                  ? 'helper'
                  : 'unknown';
        const status =
          process.status === 'running'
            ? 'running'
            : process.status === 'starting' || process.status === 'pending'
              ? 'starting'
              : 'exited';

        return {
          id: process.id,
          name: process.command.split(' ').slice(0, 3).join(' ') || nodeRow.name,
          kind,
          status,
        };
      });

      return new Response(JSON.stringify({ processes: mappedProcesses }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new Response('Not found', { status: 404 });
  },
};
