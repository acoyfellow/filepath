import { redirect, error } from "@sveltejs/kit";
import { getDrizzle } from "$lib/auth";
import { agentSession, agentNode } from "$lib/schema";
import { eq, and } from "drizzle-orm";
import type { ServerLoadEvent } from "@sveltejs/kit";

export const load = async ({ params, locals }: ServerLoadEvent) => {
  if (!locals.user) throw redirect(302, "/");

  try {
    const db = getDrizzle();

    const sessions = await db
      .select()
      .from(agentSession)
      .where(
        and(
          eq(agentSession.id, params.id as string),
          eq(agentSession.userId, locals.user.id),
        ),
      );

    if (sessions.length === 0) throw error(404, "Session not found");

    const session = sessions[0];

    const nodes = await db
      .select()
      .from(agentNode)
      .where(eq(agentNode.sessionId, params.id as string))
      .orderBy(agentNode.sortOrder);

    return {
      user: locals.user,
      session,
      nodes,
    };
  } catch (err) {
    // Re-throw SvelteKit errors (redirect, error())
    if (err && typeof err === "object" && "status" in err) throw err;

    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("no such table")) {
      throw error(503, "Database migration required. Run: wrangler d1 execute filepath-db --file=migrations/0001_agent_tables.sql --remote");
    }
    throw err;
  }
};
