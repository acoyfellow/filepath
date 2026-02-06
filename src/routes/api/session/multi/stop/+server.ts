import { json, error } from '@sveltejs/kit';
import { getDrizzle } from '$lib/auth';
import { multiAgentSession, agentSlot } from '$lib/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/**
 * POST /api/session/multi/stop - Stop a multi-agent session and all its agent slots
 */
export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized');
  }

  let body: { sessionId: string };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON body');
  }

  if (!body.sessionId || typeof body.sessionId !== 'string') {
    throw error(400, 'Missing required field: sessionId');
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

    // Idempotent: already stopped is a no-op
    if (sessions[0].status === 'stopped') {
      return json({ success: true, alreadyStopped: true });
    }

    // Update session status to stopped
    await db
      .update(multiAgentSession)
      .set({ status: 'stopped' })
      .where(eq(multiAgentSession.id, body.sessionId));

    // Update all agent slots to stopped
    await db
      .update(agentSlot)
      .set({ status: 'stopped' })
      .where(eq(agentSlot.sessionId, body.sessionId));

    return json({ success: true });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Error stopping multi-agent session:', err);
    throw error(500, 'Failed to stop multi-agent session');
  }
};
