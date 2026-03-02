import { error, json } from "@sveltejs/kit";
import { getDrizzle } from "$lib/auth";
import { agentNode, agentSession } from "$lib/schema";
import { and, eq } from "drizzle-orm";
import type { RequestEvent, RequestHandler } from "@sveltejs/kit";

interface FlatNode {
  id: string;
  parentId: string | null;
  sortOrder: number;
}

function collectDescendants(nodes: FlatNode[], parentId: string): Set<string> {
  const descendants = new Set<string>();
  const queue = [parentId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const node of nodes) {
      if (node.parentId === current && !descendants.has(node.id)) {
        descendants.add(node.id);
        queue.push(node.id);
      }
    }
  }

  return descendants;
}

export const POST: RequestHandler = async ({
  params,
  request,
  locals,
}: RequestEvent) => {
  if (!locals.user) throw error(401, "Unauthorized");

  const sessionId = params.id!;
  const nodeId = params.nodeId!;
  const body = (await request.json()) as {
    parentId: string | null;
    sortOrder: number;
  };

  const db = getDrizzle();
  const ownership = await db
    .select({ id: agentSession.id })
    .from(agentSession)
    .where(and(eq(agentSession.id, sessionId), eq(agentSession.userId, locals.user.id)));

  if (ownership.length === 0) throw error(404, "Session not found");

  const nodes = await db
    .select({
      id: agentNode.id,
      parentId: agentNode.parentId,
      sortOrder: agentNode.sortOrder,
    })
    .from(agentNode)
    .where(eq(agentNode.sessionId, sessionId));

  const movingNode = nodes.find((node) => node.id === nodeId);
  if (!movingNode) throw error(404, "Thread not found");

  if (body.parentId === nodeId) {
    throw error(400, "A thread cannot be moved under itself");
  }

  if (body.parentId && !nodes.some((node) => node.id === body.parentId)) {
    throw error(400, "Destination thread not found");
  }

  const descendants = collectDescendants(nodes, nodeId);
  if (body.parentId && descendants.has(body.parentId)) {
    throw error(400, "A thread cannot be moved under its descendant");
  }

  const clampIndex = (value: number, max: number) =>
    Math.max(0, Math.min(Number.isFinite(value) ? Math.floor(value) : 0, max));

  const sameParent = movingNode.parentId === body.parentId;

  if (sameParent) {
    const siblingIds = nodes
      .filter((node) => node.parentId === movingNode.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((node) => node.id)
      .filter((id) => id !== nodeId);

    siblingIds.splice(clampIndex(body.sortOrder, siblingIds.length), 0, nodeId);

    for (let index = 0; index < siblingIds.length; index += 1) {
      await db
        .update(agentNode)
        .set({
          parentId: movingNode.parentId,
          sortOrder: index,
        })
        .where(and(eq(agentNode.id, siblingIds[index]), eq(agentNode.sessionId, sessionId)));
    }

    return json({ ok: true });
  }

  const oldSiblingIds = nodes
    .filter((node) => node.parentId === movingNode.parentId && node.id !== nodeId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((node) => node.id);

  const newSiblingIds = nodes
    .filter((node) => node.parentId === body.parentId && node.id !== nodeId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((node) => node.id);

  newSiblingIds.splice(clampIndex(body.sortOrder, newSiblingIds.length), 0, nodeId);

  for (let index = 0; index < oldSiblingIds.length; index += 1) {
    await db
      .update(agentNode)
      .set({ sortOrder: index })
      .where(and(eq(agentNode.id, oldSiblingIds[index]), eq(agentNode.sessionId, sessionId)));
  }

  for (let index = 0; index < newSiblingIds.length; index += 1) {
    await db
      .update(agentNode)
      .set({
        parentId: body.parentId,
        sortOrder: index,
      })
      .where(and(eq(agentNode.id, newSiblingIds[index]), eq(agentNode.sessionId, sessionId)));
  }

  return json({ ok: true });
};
