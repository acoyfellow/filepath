import { json, error } from "@sveltejs/kit";
import { getDrizzle } from "$lib/auth";
import { agentSession, agentNode } from "$lib/schema";
import { eq, desc, sql, count, inArray } from "drizzle-orm";
import type { RequestHandler, RequestEvent } from "@sveltejs/kit";

function generateId(length = 16): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * GET /api/sessions - List all agent sessions for the authenticated user
 */
export const GET: RequestHandler = async ({ locals }: RequestEvent) => {
  if (!locals.user) throw error(401, "Unauthorized");

  const db = getDrizzle();
  
  // Get all sessions for user
  const sessionsData = await db
    .select()
    .from(agentSession)
    .where(eq(agentSession.userId, locals.user.id))
    .orderBy(desc(agentSession.updatedAt));

  // Get node counts for each session
  const sessionIds = sessionsData.map(s => s.id);
  
  let nodeCounts: { sessionId: string; count: number }[] = [];
  if (sessionIds.length > 0) {
    nodeCounts = await db
      .select({
        sessionId: agentNode.sessionId,
        count: count()
      })
      .from(agentNode)
      .where(inArray(agentNode.sessionId, sessionIds))
      .groupBy(agentNode.sessionId);
  }

  const countMap = new Map(nodeCounts.map(n => [n.sessionId, n.count]));
  
  const sessions = sessionsData.map(s => ({
    id: s.id,
    name: s.name,
    gitRepoUrl: s.gitRepoUrl,
    status: s.status,
    rootNodeId: s.rootNodeId,
    startedAt: s.startedAt,
    createdAt: s.createdAt?.getTime() ?? 0,
    updatedAt: s.updatedAt?.getTime() ?? 0,
    nodeCount: countMap.get(s.id) ?? 0,
  }));

  return json({ sessions });
};

/**
 * POST /api/sessions - Create a new agent session
 * Body: { name?: string, gitRepoUrl?: string }
 */
export const POST: RequestHandler = async ({ request, locals }: RequestEvent) => {
  if (!locals.user) throw error(401, "Unauthorized");

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    gitRepoUrl?: string;
  };

  const id = generateId();
  const name = body.name?.trim() || `Session ${id.slice(0, 6)}`;

  const db = getDrizzle();
  await db.insert(agentSession).values({
    id,
    userId: locals.user.id,
    name,
    gitRepoUrl: body.gitRepoUrl || null,
    status: "draft",
  });

  return json({ id, name }, { status: 201 });
};
