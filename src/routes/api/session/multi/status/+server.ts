import { json, error } from '@sveltejs/kit';
import { getDrizzle } from '$lib/auth';
import { multiAgentSession, agentSlot } from '$lib/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/**
 * GET /api/session/multi/status?id=X
 * Lightweight status-only endpoint for polling.
 * Returns minimal data: session status + slot statuses.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const sessionId = url.searchParams.get('id');
	if (!sessionId) {
		throw error(400, 'Missing required query parameter: id');
	}

	try {
		const db = getDrizzle();

		const sessions = await db
			.select({
				id: multiAgentSession.id,
				status: multiAgentSession.status,
				userId: multiAgentSession.userId,
			})
			.from(multiAgentSession)
			.where(eq(multiAgentSession.id, sessionId));

		const mas = sessions[0];
		if (!mas) {
			throw error(404, 'Multi-agent session not found');
		}

		if (mas.userId !== locals.user.id) {
			throw error(403, 'Forbidden');
		}

		const slotRows = await db
			.select({
				id: agentSlot.id,
				status: agentSlot.status,
				containerId: agentSlot.containerId,
			})
			.from(agentSlot)
			.where(eq(agentSlot.sessionId, sessionId));

		return json({
			session: { id: mas.id, status: mas.status },
			slots: slotRows,
		});
	} catch (err: unknown) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		console.error('Error fetching session status:', err);
		throw error(500, 'Failed to fetch session status');
	}
};
