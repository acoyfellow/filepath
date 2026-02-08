import { json, error } from "@sveltejs/kit";
import { getDrizzle } from "$lib/auth";
import { agentSession, agentNode } from "$lib/schema";
import { eq, and } from "drizzle-orm";
import type { RequestHandler } from "./$types";

/** Verify user owns session */
async function verifyOwnership(
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
}

/**
 * GET /api/sessions/[id]/nodes/[nodeId] - Get a single node
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw error(401, "Unauthorized");

  const db = getDrizzle();
  await verifyOwnership(db, params.id, locals.user.id);

  const nodes = await db
    .select()
    .from(agentNode)
    .where(
      and(eq(agentNode.id, params.nodeId), eq(agentNode.sessionId, params.id)),
    );

  if (nodes.length === 0) throw error(404, "Node not found");

  return json({ node: nodes[0] });
};

/**
 * PATCH /api/sessions/[id]/nodes/[nodeId] - Update node (status, config, name, etc.)
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) throw error(401, "Unauthorized");

  const body = (await request.json()) as {
    name?: string;
    status?: string;
    config?: Record<string, unknown>;
    containerId?: string;
    tokens?: number;
  };

  const db = getDrizzle();
  await verifyOwnership(db, params.id, locals.user.id);

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.status !== undefined) updates.status = body.status;
  if (body.config !== undefined) updates.config = JSON.stringify(body.config);
  if (body.containerId !== undefined) updates.containerId = body.containerId;
  if (body.tokens !== undefined) updates.tokens = body.tokens;

  if (Object.keys(updates).length === 0) {
    return json({ ok: true });
  }

  await db
    .update(agentNode)
    .set(updates)
    .where(
      and(eq(agentNode.id, params.nodeId), eq(agentNode.sessionId, params.id)),
    );

  return json({ ok: true });
};

/**
 * DELETE /api/sessions/[id]/nodes/[nodeId] - Delete a node and all descendants
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw error(401, "Unauthorized");

  const db = getDrizzle();
  await verifyOwnership(db, params.id, locals.user.id);

  // Collect all descendant node IDs (recursive via repeated queries)
  const toDelete = new Set<string>([params.nodeId]);
  const queue = [params.nodeId];

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    const children = await db
      .select({ id: agentNode.id })
      .from(agentNode)
      .where(
        and(
          eq(agentNode.parentId, parentId),
          eq(agentNode.sessionId, params.id),
        ),
      );

    for (const child of children) {
      if (!toDelete.has(child.id)) {
        toDelete.add(child.id);
        queue.push(child.id);
      }
    }
  }

  // Delete all descendants + the node itself
  for (const nodeId of toDelete) {
    await db
      .delete(agentNode)
      .where(
        and(eq(agentNode.id, nodeId), eq(agentNode.sessionId, params.id)),
      );
  }

  return json({ ok: true, deleted: toDelete.size });
};
