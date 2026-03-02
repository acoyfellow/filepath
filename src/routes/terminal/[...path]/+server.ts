import { error } from '@sveltejs/kit';
import { getDrizzle } from '$lib/auth';
import { agentSession, agentNode } from '$lib/schema';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

async function verifyTerminalAccess(
  path: string,
  userId: string | undefined
): Promise<void> {
  if (!userId) throw error(401, 'Unauthorized');

  const match = path.match(/^session\/([^/]+)\/node\/([^/]+)/);
  if (!match) {
    return;
  }

  const [, sessionId, nodeId] = match;
  const db = getDrizzle();
  const rows = await db
    .select({ id: agentNode.id })
    .from(agentNode)
    .innerJoin(agentSession, eq(agentNode.sessionId, agentSession.id))
    .where(
      and(
        eq(agentNode.id, nodeId),
        eq(agentNode.sessionId, sessionId),
        eq(agentSession.userId, userId),
      ),
    );

  if (rows.length === 0) {
    throw error(404, 'Thread not found');
  }
}

// Proxy /terminal/* HTTP requests to worker
// WebSocket goes directly to api.myfilepath.com (handled client-side)
export const GET: RequestHandler = async ({ params, request, platform, locals }) => {
  await verifyTerminalAccess(params.path, locals.user?.id);
  const worker = platform?.env?.WORKER;
  if (!worker) {
    return new Response('Worker not available', { status: 503 });
  }
  
  const url = new URL(request.url);
  url.pathname = `/terminal/${params.path}`;
  
  return worker.fetch(new Request(url, request));
};

export const POST: RequestHandler = async ({ params, request, platform, locals }) => {
  await verifyTerminalAccess(params.path, locals.user?.id);
  const worker = platform?.env?.WORKER;
  if (!worker) {
    return new Response('Worker not available', { status: 503 });
  }
  
  const url = new URL(request.url);
  url.pathname = `/terminal/${params.path}`;
  
  return worker.fetch(new Request(url, request));
};
