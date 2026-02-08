import { redirect, error } from "@sveltejs/kit";
import { getDrizzle } from "$lib/auth";
import { agentSession, agentNode } from "$lib/schema";
import { eq, and } from "drizzle-orm";
import type { ServerLoadEvent } from "@sveltejs/kit";

export const load = async ({ params, locals }: ServerLoadEvent) => {
  if (!locals.user) throw redirect(302, "/");

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
};
