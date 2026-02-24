import { json, error } from "@sveltejs/kit";
import { getDrizzle } from "$lib/auth";
import { agentSession, agentNode } from "$lib/schema";
import { eq, and } from "drizzle-orm";
import type { RequestHandler, RequestEvent } from "@sveltejs/kit";

/**
 * GET /api/sessions/[id]/status - Real-time status overview
 * Returns session status + all node statuses for tree rendering
 */
export const GET: RequestHandler = async ({ params, locals }: RequestEvent) => {
  if (!locals.user) throw error(401, "Unauthorized");
  const id = params.id!;

  const db = getDrizzle();

  const sessions = await db
    .select({
      id: agentSession.id,
      status: agentSession.status,
      name: agentSession.name,
    })
    .from(agentSession)
    .where(
      and(
        eq(agentSession.id, id),
        eq(agentSession.userId, locals.user.id),
      ),
    );

  if (sessions.length === 0) throw error(404, "Session not found");

  const nodes = await db
    .select({
      id: agentNode.id,
      name: agentNode.name,
      status: agentNode.status,
      parentId: agentNode.parentId,
      agentType: agentNode.agentType,
      tokens: agentNode.tokens,
      containerId: agentNode.containerId,
    })
    .from(agentNode)
    .where(eq(agentNode.sessionId, id));

  const totalNodes = nodes.length;
  const doneNodes = nodes.filter((n) => n.status === "done").length;
  const runningNodes = nodes.filter(
    (n) => n.status === "running" || n.status === "thinking",
  ).length;
  const errorNodes = nodes.filter((n) => n.status === "error").length;

  return json({
    session: sessions[0],
    nodes,
    summary: {
      total: totalNodes,
      done: doneNodes,
      running: runningNodes,
      error: errorNodes,
    },
  });
};
