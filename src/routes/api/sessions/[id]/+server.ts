import { json, error } from "@sveltejs/kit";
import { getDrizzle } from "$lib/auth";
import { agentSession, agentNode } from "$lib/schema";
import { eq, and } from "drizzle-orm";
import type { RequestHandler } from "./$types";

/**
 * GET /api/sessions/[id] - Get a single session with its full node tree
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw error(401, "Unauthorized");

  const db = getDrizzle();

  const sessions = await db
    .select()
    .from(agentSession)
    .where(
      and(
        eq(agentSession.id, params.id),
        eq(agentSession.userId, locals.user.id),
      ),
    );

  if (sessions.length === 0) throw error(404, "Session not found");

  const session = sessions[0];

  // Get all nodes for this session
  const nodes = await db
    .select()
    .from(agentNode)
    .where(eq(agentNode.sessionId, params.id))
    .orderBy(agentNode.sortOrder);

  // Build tree structure
  const nodeMap = new Map<string, typeof nodes[0] & { children: typeof nodes }>();
  for (const node of nodes) {
    nodeMap.set(node.id, { ...node, children: [] });
  }

  const roots: (typeof nodes[0] & { children: typeof nodes })[] = [];
  for (const node of nodeMap.values()) {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return json({ session, tree: roots });
};

/**
 * PATCH /api/sessions/[id] - Update session (name, status, etc.)
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) throw error(401, "Unauthorized");

  const body = (await request.json()) as {
    name?: string;
    status?: string;
    gitRepoUrl?: string;
  };

  const db = getDrizzle();

  // Verify ownership
  const sessions = await db
    .select({ id: agentSession.id })
    .from(agentSession)
    .where(
      and(
        eq(agentSession.id, params.id),
        eq(agentSession.userId, locals.user.id),
      ),
    );

  if (sessions.length === 0) throw error(404, "Session not found");

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.status !== undefined) updates.status = body.status;
  if (body.gitRepoUrl !== undefined) updates.gitRepoUrl = body.gitRepoUrl;

  if (Object.keys(updates).length === 0) {
    return json({ ok: true });
  }

  await db
    .update(agentSession)
    .set(updates)
    .where(eq(agentSession.id, params.id));

  return json({ ok: true });
};

/**
 * DELETE /api/sessions/[id] - Delete session (cascades to nodes)
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw error(401, "Unauthorized");

  const db = getDrizzle();

  // Verify ownership
  const sessions = await db
    .select({ id: agentSession.id })
    .from(agentSession)
    .where(
      and(
        eq(agentSession.id, params.id),
        eq(agentSession.userId, locals.user.id),
      ),
    );

  if (sessions.length === 0) throw error(404, "Session not found");

  // Cascading delete handles nodes
  await db.delete(agentSession).where(eq(agentSession.id, params.id));

  return json({ ok: true });
};
