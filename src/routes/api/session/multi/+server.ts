import { json, error } from '@sveltejs/kit';
import { getDrizzle } from '$lib/auth';
import { multiAgentSession, agentSlot, user as userTable } from '$lib/schema';
import { eq, desc, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

interface AgentConfig {
  [key: string]: unknown;
}

interface CreateMultiSessionBody {
  name: string;
  description?: string;
  gitRepoUrl?: string;
  orchestrator: {
    agentType: string;
    config: AgentConfig;
  };
  workers: Array<{
    agentType: string;
    name: string;
    config: AgentConfig;
  }>;
}

/**
 * GET /api/session/multi?id=X - Get a multi-agent session with its slots
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
      .select()
      .from(multiAgentSession)
      .where(eq(multiAgentSession.id, sessionId));

    if (sessions.length === 0) {
      throw error(404, 'Multi-agent session not found');
    }

    const mas = sessions[0];

    // Ensure the session belongs to the requesting user
    if (mas.userId !== locals.user.id) {
      throw error(403, 'Forbidden');
    }

    const slots = await db
      .select()
      .from(agentSlot)
      .where(eq(agentSlot.sessionId, sessionId));

    return json({
      session: {
        ...mas,
        config: undefined,
      },
      slots: slots.map((s) => ({
        ...s,
        config: JSON.parse(s.config),
      })),
    });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Error fetching multi-agent session:', err);
    throw error(500, 'Failed to fetch multi-agent session');
  }
};

/**
 * POST /api/session/multi - Create a new multi-agent session
 */
export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized');
  }

  let body: CreateMultiSessionBody;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON body');
  }

  // Validate required fields
  if (!body.name || typeof body.name !== 'string') {
    throw error(400, 'Missing required field: name');
  }
  if (!body.orchestrator || !body.orchestrator.agentType) {
    throw error(400, 'Missing required field: orchestrator.agentType');
  }
  if (!Array.isArray(body.workers)) {
    throw error(400, 'Missing required field: workers (must be an array)');
  }
  for (const w of body.workers) {
    if (!w.agentType || !w.name) {
      throw error(400, 'Each worker must have agentType and name');
    }
  }

  try {
    const db = getDrizzle();

    // Check user's credit balance
    const users = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, locals.user.id));

    if (users.length === 0) {
      throw error(404, 'User not found');
    }

    const creditBalance = users[0].creditBalance || 0;
    if (creditBalance < 1) {
      throw error(
        402,
        'Insufficient credits. Please add credits to your account to create a session.',
      );
    }

    // Generate IDs
    const sessionId = crypto.randomUUID();
    const orchestratorSlotId = crypto.randomUUID();

    // Insert multi-agent session (without orchestrator_slot_id initially)
    await db.insert(multiAgentSession).values({
      id: sessionId,
      userId: locals.user.id,
      name: body.name,
      description: body.description ?? null,
      gitRepoUrl: body.gitRepoUrl ?? null,
      status: 'draft',
    });

    // Insert orchestrator slot
    await db.insert(agentSlot).values({
      id: orchestratorSlotId,
      sessionId,
      role: 'orchestrator',
      agentType: body.orchestrator.agentType,
      name: 'Orchestrator',
      config: JSON.stringify(body.orchestrator.config ?? {}),
      status: 'pending',
    });

    // Insert worker slots
    for (const worker of body.workers) {
      await db.insert(agentSlot).values({
        id: crypto.randomUUID(),
        sessionId,
        role: 'worker',
        agentType: worker.agentType,
        name: worker.name,
        config: JSON.stringify(worker.config ?? {}),
        status: 'pending',
      });
    }

    // Update session with orchestrator slot id
    await db
      .update(multiAgentSession)
      .set({ orchestratorSlotId })
      .where(eq(multiAgentSession.id, sessionId));

    return json({ sessionId });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Error creating multi-agent session:', err);
    throw error(500, 'Failed to create multi-agent session');
  }
};
