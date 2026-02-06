import { json, error } from '@sveltejs/kit';
import { getDrizzle } from '$lib/auth';
import { multiAgentSession, agentSlot } from '$lib/schema';
import { eq, desc, sql, count } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/**
 * GET /api/session/multi/list - List all multi-agent sessions for the user
 */
export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized');
  }

  try {
    const db = getDrizzle();

    // Get all sessions for this user with slot counts (single query with LEFT JOIN)
    const sessionsWithCounts = await db
      .select({
        id: multiAgentSession.id,
        name: multiAgentSession.name,
        description: multiAgentSession.description,
        status: multiAgentSession.status,
        createdAt: multiAgentSession.createdAt,
        updatedAt: multiAgentSession.updatedAt,
        slotCount: count(agentSlot.id),
      })
      .from(multiAgentSession)
      .leftJoin(agentSlot, eq(agentSlot.sessionId, multiAgentSession.id))
      .where(eq(multiAgentSession.userId, locals.user.id))
      .groupBy(multiAgentSession.id)
      .orderBy(desc(multiAgentSession.updatedAt));

    return json({ sessions: sessionsWithCounts });
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('Error listing multi-agent sessions:', err);
    throw error(500, 'Failed to list sessions');
  }
};
