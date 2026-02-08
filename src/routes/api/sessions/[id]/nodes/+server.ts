import { json, error } from "@sveltejs/kit";
import { getDrizzle } from "$lib/auth";
import { agentSession, agentNode } from "$lib/schema";
import { eq, and, sql } from "drizzle-orm";
import type { RequestHandler } from "./$types";

function generateId(length = 16): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/** Verify user owns session, return session or throw */
async function verifySession(
  db: ReturnType<typeof getDrizzle>,
  sessionId: string,
  userId: string,
) {
  const sessions = await db
    .select({ id: agentSession.id })
    .from(agentSession)
    .where(
      and(eq(agentSession.id, sessionId), eq(agentSession.userId, userId)),
    );
  if (sessions.length === 0) throw error(404, "Session not found");
  return sessions[0];
}

/**
 * GET /api/sessions/[id]/nodes - List all nodes in a session (flat)
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw error(401, "Unauthorized");

  const db = getDrizzle();
  await verifySession(db, params.id, locals.user.id);

  const nodes = await db
    .select()
    .from(agentNode)
    .where(eq(agentNode.sessionId, params.id))
    .orderBy(agentNode.sortOrder);

  return json({ nodes });
};

/**
 * POST /api/sessions/[id]/nodes - Spawn a new agent node
 * Body: { name, agentType, model, parentId?, config? }
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) throw error(401, "Unauthorized");

  const body = (await request.json()) as {
    name: string;
    agentType: string;
    model: string;
    parentId?: string;
    config?: Record<string, unknown>;
  };

  if (!body.name || !body.agentType || !body.model) {
    throw error(400, "name, agentType, and model are required");
  }

  const db = getDrizzle();
  await verifySession(db, params.id, locals.user.id);

  // If parentId specified, verify it exists in this session
  if (body.parentId) {
    const parents = await db
      .select({ id: agentNode.id })
      .from(agentNode)
      .where(
        and(
          eq(agentNode.id, body.parentId),
          eq(agentNode.sessionId, params.id),
        ),
      );
    if (parents.length === 0) throw error(400, "Parent node not found");
  }

  // Get next sort order for siblings
  const siblings = body.parentId
    ? await db
        .select({ sortOrder: agentNode.sortOrder })
        .from(agentNode)
        .where(
          and(
            eq(agentNode.sessionId, params.id),
            eq(agentNode.parentId, body.parentId),
          ),
        )
    : await db
        .select({ sortOrder: agentNode.sortOrder })
        .from(agentNode)
        .where(
          and(
            eq(agentNode.sessionId, params.id),
            sql`${agentNode.parentId} IS NULL`,
          ),
        );

  const nextSort =
    siblings.length > 0
      ? Math.max(...siblings.map((s) => s.sortOrder)) + 1
      : 0;

  const nodeId = generateId();
  await db.insert(agentNode).values({
    id: nodeId,
    sessionId: params.id,
    parentId: body.parentId || null,
    name: body.name,
    agentType: body.agentType,
    model: body.model,
    config: JSON.stringify(body.config || {}),
    sortOrder: nextSort,
  });

  // If this is the first node (root), set it as rootNodeId
  if (!body.parentId) {
    const existingRoot = await db
      .select({ rootNodeId: agentSession.rootNodeId })
      .from(agentSession)
      .where(eq(agentSession.id, params.id));

    if (!existingRoot[0]?.rootNodeId) {
      await db
        .update(agentSession)
        .set({ rootNodeId: nodeId })
        .where(eq(agentSession.id, params.id));
    }
  }

  return json({ id: nodeId, name: body.name }, { status: 201 });
};
