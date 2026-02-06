import { json, error } from '@sveltejs/kit';
import { getDrizzle } from '$lib/auth';
import { multiAgentSession } from '$lib/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/**
 * POST /api/session/multi/chat - Send a chat message to a multi-agent session slot
 * Stub endpoint for future WebSocket/agent integration
 */
export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized');
  }

  let body: { sessionId: string; slotId: string; message: string };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON body');
  }

  if (!body.sessionId || typeof body.sessionId !== 'string') {
    throw error(400, 'Missing required field: sessionId');
  }
  if (!body.slotId || typeof body.slotId !== 'string') {
    throw error(400, 'Missing required field: slotId');
  }
  if (!body.message || typeof body.message !== 'string') {
    throw error(400, 'Missing required field: message');
  }

  try {
    const db = getDrizzle();

    const sessions = await db
      .select()
      .from(multiAgentSession)
      .where(eq(multiAgentSession.id, body.sessionId));

    if (sessions.length === 0) {
      throw error(404, 'Multi-agent session not found');
    }

    if (sessions[0].userId !== locals.user.id) {
      throw error(403, 'Forbidden');
    }

    return json({ success: true, messageId: crypto.randomUUID() });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Error sending chat message:', err);
    throw error(500, 'Failed to send chat message');
  }
};
