import { json, error } from '@sveltejs/kit';
import { getDrizzle } from '$lib/auth';
import { multiAgentSession, agentSlot, user as userTable } from '$lib/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/**
 * POST /api/session/multi/start - Start a multi-agent session
 *
 * 1. Validates ownership + credits
 * 2. Assigns containerId to each slot
 * 3. Calls worker to spin up containers
 * 4. Updates slot/session statuses
 */
export const POST: RequestHandler = async ({ locals, request, platform }) => {
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

    // Load session
    const sessions = await db
      .select()
      .from(multiAgentSession)
      .where(eq(multiAgentSession.id, body.sessionId));

    const sess = sessions[0];
    if (!sess) {
      throw error(404, 'Session not found');
    }

    if (sess.userId !== locals.user.id) {
      throw error(403, 'Forbidden');
    }

    if (sess.status !== 'draft' && sess.status !== 'stopped') {
      throw error(409, `Cannot start session in '${sess.status}' state`);
    }

    // Check credits
    const users = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, locals.user.id));

    const creditBalance = users[0]?.creditBalance || 0;
    if (creditBalance < 1) {
      throw error(402, 'Insufficient credits');
    }

    // Load slots
    const slots = await db
      .select()
      .from(agentSlot)
      .where(eq(agentSlot.sessionId, body.sessionId));

    if (slots.length === 0) {
      throw error(400, 'Session has no agent slots');
    }

    // Transition session to 'starting' and record start time for billing
    const now = new Date();
    await db
      .update(multiAgentSession)
      .set({ status: 'starting', startedAt: now, lastBilledAt: now })
      .where(eq(multiAgentSession.id, body.sessionId));

    // Assign containerIds and transition slots to 'starting'
    const slotContainers: Array<{ id: string; containerId: string }> = [];
    for (const slot of slots) {
      if (slot.status === 'pending' || slot.status === 'stopped' || slot.status === 'starting' || slot.status === 'error') {
        const containerId = `agent-${body.sessionId.slice(0, 8)}-${slot.id.slice(0, 8)}`.toLowerCase();
        await db
          .update(agentSlot)
          .set({ status: 'starting', containerId })
          .where(eq(agentSlot.id, slot.id));
        slotContainers.push({ id: slot.id, containerId });
      }
    }

    // Call worker to spin up containers
    const worker = (platform?.env as Record<string, unknown> | undefined)?.WORKER as
      | { fetch: (req: Request) => Promise<Response> }
      | undefined;

    if (worker && slotContainers.length > 0) {
      try {
        const workerRes = await worker.fetch(
          new Request('https://internal/start-agent-slots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slots: slotContainers, gitRepoUrl: sess.gitRepoUrl ?? undefined }),
          }),
        );

        if (workerRes.ok) {
          const data = (await workerRes.json()) as {
            results: Array<{ slotId: string; status: string; error?: string }>;
          };

          // Update slot statuses based on container results
          for (const result of data.results) {
            await db
              .update(agentSlot)
              .set({ status: result.status as 'running' | 'error' })
              .where(eq(agentSlot.id, result.slotId));
          }
        } else {
          console.error('Worker start-agent-slots failed:', workerRes.status);
          // Mark all as error
          for (const sc of slotContainers) {
            await db
              .update(agentSlot)
              .set({ status: 'error' })
              .where(eq(agentSlot.id, sc.id));
          }
        }
      } catch (err) {
        console.error('Worker call failed:', err);
        for (const sc of slotContainers) {
          await db
            .update(agentSlot)
            .set({ status: 'error' })
            .where(eq(agentSlot.id, sc.id));
        }
      }
    } else if (!worker) {
      // No worker binding (local dev) — mark running for UI testing
      for (const sc of slotContainers) {
        await db
          .update(agentSlot)
          .set({ status: 'running' })
          .where(eq(agentSlot.id, sc.id));
      }
    }

    // Determine final session status
    const updatedSlots = await db
      .select()
      .from(agentSlot)
      .where(eq(agentSlot.sessionId, body.sessionId));

    const allRunning = updatedSlots.every((s) => s.status === 'running');
    const anyError = updatedSlots.some((s) => s.status === 'error');
    const finalStatus = anyError ? 'error' : allRunning ? 'running' : 'starting';

    await db
      .update(multiAgentSession)
      .set({ status: finalStatus })
      .where(eq(multiAgentSession.id, body.sessionId));

    return json({
      success: true,
      status: finalStatus,
      slots: updatedSlots.map((s) => ({
        id: s.id,
        status: s.status,
        containerId: s.containerId,
      })),
    });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Error starting multi-agent session:', err);
    throw error(500, 'Failed to start session');
  }
};
