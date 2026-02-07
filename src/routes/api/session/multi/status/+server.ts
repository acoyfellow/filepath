import { json, error } from '@sveltejs/kit';
import { getDrizzle } from '$lib/auth';
import { multiAgentSession, agentSlot, user as userTable } from '$lib/schema';
import { eq, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/** Credits per running slot per minute ($0.01/min) */
const CREDITS_PER_SLOT_PER_MINUTE = 1;

/**
 * Deduct per-minute credits for running containers.
 * Called during status polling. Only deducts if >= 1 minute since last bill.
 * Returns the new credit balance (or null if no deduction needed).
 */
async function deductPerMinuteCredits(
	db: ReturnType<typeof getDrizzle>,
	sessionId: string,
	userId: string,
	runningSlotCount: number
): Promise<{ deducted: number; balance: number; insufficientCredits: boolean } | null> {
	if (runningSlotCount === 0) return null;

	// Get session billing timestamps
	const sessions = await db
		.select({
			startedAt: multiAgentSession.startedAt,
			lastBilledAt: multiAgentSession.lastBilledAt,
		})
		.from(multiAgentSession)
		.where(eq(multiAgentSession.id, sessionId));

	const sess = sessions[0];
	if (!sess?.lastBilledAt) return null;

	const now = Date.now();
	const lastBilled = sess.lastBilledAt.getTime();
	const elapsedMinutes = Math.floor((now - lastBilled) / 60000);

	if (elapsedMinutes < 1) return null;

	const creditsToDeduct = elapsedMinutes * runningSlotCount * CREDITS_PER_SLOT_PER_MINUTE;

	// Get current balance
	const users = await db
		.select({ creditBalance: userTable.creditBalance })
		.from(userTable)
		.where(eq(userTable.id, userId));

	const balance = users[0]?.creditBalance ?? 0;

	if (balance < creditsToDeduct) {
		// Deduct whatever is left, signal insufficient credits
		const remaining = Math.max(0, balance);
		if (remaining > 0) {
			await db
				.update(userTable)
				.set({ creditBalance: sql`${userTable.creditBalance} - ${remaining}` })
				.where(eq(userTable.id, userId));
		}
		await db
			.update(multiAgentSession)
			.set({ lastBilledAt: new Date(lastBilled + elapsedMinutes * 60000) })
			.where(eq(multiAgentSession.id, sessionId));

		return { deducted: remaining, balance: 0, insufficientCredits: true };
	}

	// Atomic deduction
	await db
		.update(userTable)
		.set({ creditBalance: sql`${userTable.creditBalance} - ${creditsToDeduct}` })
		.where(eq(userTable.id, userId));

	await db
		.update(multiAgentSession)
		.set({ lastBilledAt: new Date(lastBilled + elapsedMinutes * 60000) })
		.where(eq(multiAgentSession.id, sessionId));

	return { deducted: creditsToDeduct, balance: balance - creditsToDeduct, insufficientCredits: false };
}

/**
 * GET /api/session/multi/status?id=X
 * Lightweight status-only endpoint for polling.
 * Also handles per-minute credit deduction for running sessions.
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

		// Per-minute credit deduction for running sessions
		let billing: { deducted: number; balance: number; insufficientCredits: boolean } | null = null;
		if (mas.status === 'running') {
			const runningCount = slotRows.filter((s) => s.status === 'running').length;
			try {
				billing = await deductPerMinuteCredits(db, sessionId, mas.userId, runningCount);
			} catch (err) {
				console.error('[billing] Per-minute deduction failed:', err);
			}
		}

		return json({
			session: { id: mas.id, status: mas.status },
			slots: slotRows,
			...(billing ? { billing } : {}),
		});
	} catch (err: unknown) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		console.error('Error fetching session status:', err);
		throw error(500, 'Failed to fetch session status');
	}
};
