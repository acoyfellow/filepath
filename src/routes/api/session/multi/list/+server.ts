import { json, error } from '@sveltejs/kit';
import { getDrizzle } from '$lib/auth';
import { multiAgentSession, agentSlot } from '$lib/schema';
import { eq, desc, sql } from 'drizzle-orm';
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

    // Get all sessions for this user with slot counts
    const sessions = await db
      .select({
        id: multiAgentSession.id,
        name: multiAgentSession.name,
        description: multiAgentSession.description,
        status: multiAgentSession.status,
        createdAt: multiAgentSession.createdAt,
        updatedAt: multiAgentSession.updatedAt,
      })
      .from(multiAgentSession)
      .where(eq(multiAgentSession.userId, locals.user.id))
      .orderBy(desc(multiAgentSession.updatedAt));

    // Get slot counts for each session
    const sessionsWithCounts = await Promise.all(
      sessions.map(async (s) => {
        const slots = await db
          .select({ id: agentSlot.id })
          .from(agentSlot)
          .where(eq(agentSlot.sessionId, s.id));
        return {
          ...s,
          slotCount: slots.length,
        };
      })
    );

    return json({ sessions: sessionsWithCounts });
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('Error listing multi-agent sessions:', err);
    throw error(500, 'Failed to list sessions');
  }
};
