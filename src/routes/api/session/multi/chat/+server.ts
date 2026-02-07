import { json, error } from '@sveltejs/kit';
import { getDrizzle } from '$lib/auth';
import { multiAgentSession, agentSlot } from '$lib/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/**
 * POST /api/session/multi/chat - Send a server-side message to an agent slot's ChatAgent DO.
 *
 * Primary chat flows over WebSocket directly to the ChatAgent DO.
 * This REST endpoint exists for:
 *   - Server-side message injection (e.g., orchestrator → worker instructions)
 *   - Automated triggers (session start prompts, health checks)
 *
 * Body: { sessionId, slotId, message, role? }
 */
export const POST: RequestHandler = async ({ locals, request, platform }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized');
  }

  let body: { sessionId: string; slotId: string; message: string; role?: string };
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

    if (sessions[0]?.userId !== locals.user.id) {
      throw error(403, 'Forbidden');
    }

    // Verify slotId belongs to this session
    const slots = await db
      .select()
      .from(agentSlot)
      .where(eq(agentSlot.id, body.slotId));

    if (slots.length === 0 || slots[0]?.sessionId !== body.sessionId) {
      throw error(404, 'Agent slot not found in this session');
    }

    // Route message to ChatAgent DO via the Worker binding
    const worker = (platform?.env as Record<string, unknown> | undefined)?.WORKER as
      | { fetch: (req: Request) => Promise<Response> }
      | undefined;

    if (worker) {
      // Send message to ChatAgent DO via the agents SDK HTTP endpoint
      // The ChatAgent DO accepts POST /agents/chat-agent/{name} with chat messages
      const agentName = `chat-${body.slotId}`;
      const agentUrl = `https://internal/agents/chat-agent/${agentName}`;

      const chatPayload = {
        messages: [
          {
            id: crypto.randomUUID(),
            role: body.role === 'system' ? 'system' : 'user',
            parts: [{ type: 'text', text: body.message }],
          },
        ],
      };

      try {
        const agentRes = await worker.fetch(
          new Request(agentUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chatPayload),
          }),
        );

        if (!agentRes.ok) {
          console.error(`ChatAgent responded with ${agentRes.status}`);
          return json({
            success: false,
            error: `Agent returned ${agentRes.status}`,
          }, { status: 502 });
        }

        return json({ success: true, messageId: crypto.randomUUID() });
      } catch (err) {
        console.error('Failed to reach ChatAgent DO:', err);
        return json({
          success: false,
          error: 'Failed to reach agent',
        }, { status: 502 });
      }
    }

    // No worker binding (local dev fallback)
    return json({ success: true, messageId: crypto.randomUUID(), note: 'no-worker-binding' });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Error sending chat message:', err);
    throw error(500, 'Failed to send chat message');
  }
};
