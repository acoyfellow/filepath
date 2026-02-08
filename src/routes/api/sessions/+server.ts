import { json, error } from "@sveltejs/kit";
import { getDrizzle } from "$lib/auth";
import { agentSession, agentNode } from "$lib/schema";
import { eq, desc, sql } from "drizzle-orm";
import type { RequestHandler } from "./$types";

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
export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) throw error(401, "Unauthorized");

  try {
    const db = getDrizzle();
    const sessions = await db
      .select({
        id: agentSession.id,
        name: agentSession.name,
        gitRepoUrl: agentSession.gitRepoUrl,
        status: agentSession.status,
        rootNodeId: agentSession.rootNodeId,
        startedAt: agentSession.startedAt,
        createdAt: agentSession.createdAt,
        updatedAt: agentSession.updatedAt,
        nodeCount: sql<number>`(SELECT COUNT(*) FROM agent_node WHERE session_id = ${agentSession.id})`,
      })
      .from(agentSession)
      .where(eq(agentSession.userId, locals.user.id))
      .orderBy(desc(agentSession.updatedAt));

    return json({ sessions });
  } catch (err) {
    // Table may not exist yet if migration hasn't been applied
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("no such table") || msg.includes("agent_session")) {
      console.error("[/api/sessions] agent_session table missing. Run: wrangler d1 execute filepath-db --file=migrations/0001_agent_tables.sql --remote");
      return json({ sessions: [], _migrationNeeded: true });
    }
    throw err;
  }
};

/**
 * POST /api/sessions - Create a new agent session
 * Body: { name?: string, gitRepoUrl?: string }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) throw error(401, "Unauthorized");

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    gitRepoUrl?: string;
  };

  const id = generateId();
  const name = body.name?.trim() || `Session ${id.slice(0, 6)}`;

  try {
    const db = getDrizzle();
    await db.insert(agentSession).values({
      id,
      userId: locals.user.id,
      name,
      gitRepoUrl: body.gitRepoUrl || null,
      status: "draft",
    });

    return json({ id, name }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("no such table") || msg.includes("agent_session")) {
      throw error(503, "Database migration required. Agent tables not yet created.");
    }
    throw err;
  }
};
