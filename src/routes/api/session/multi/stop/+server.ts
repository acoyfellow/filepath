import { json, error } from '@sveltejs/kit';
import { getDrizzle } from '$lib/auth';
import { multiAgentSession, agentSlot } from '$lib/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/**
 * POST /api/session/multi/stop - Stop a multi-agent session and all its agent slots
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

    const sessions = await db
      .select()
      .from(multiAgentSession)
      .where(eq(multiAgentSession.id, body.sessionId));

    const mas = sessions[0];
    if (!mas) {
      throw error(404, 'Multi-agent session not found');
    }

    if (mas.userId !== locals.user.id) {
      throw error(403, 'Forbidden');
    }

    // Idempotent: already stopped is a no-op
    if (mas.status === 'stopped') {
      return json({ success: true, alreadyStopped: true });
    }

    // Load slots to get containerIds for killing containers
    const slots = await db
      .select()
      .from(agentSlot)
      .where(eq(agentSlot.sessionId, body.sessionId));

    // Kill containers via the worker before updating DB
    const containerIds = slots
      .filter((s) => s.containerId && s.status !== 'stopped' && s.status !== 'pending')
      .map((s) => s.containerId as string);

    if (containerIds.length > 0) {
      const worker = (platform?.env as Record<string, unknown> | undefined)?.WORKER as
        | { fetch: (req: Request) => Promise<Response> }
        | undefined;

      if (worker) {
        try {
          const workerRes = await worker.fetch(
            new Request('https://internal/stop-agent-slots', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ containerIds }),
            }),
          );

          if (!workerRes.ok) {
            console.error('Worker stop-agent-slots failed:', workerRes.status);
          }
        } catch (err) {
          console.error('Worker stop call failed:', err);
        }
      }
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
