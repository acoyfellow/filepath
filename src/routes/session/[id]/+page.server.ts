import { redirect, error } from "@sveltejs/kit";
import { getDrizzle } from "$lib/auth";
import { agentSession, agentNode, user } from "$lib/schema";
import { eq, and } from "drizzle-orm";
import type { ServerLoadEvent } from "@sveltejs/kit";

export const load = async ({ params, locals }: ServerLoadEvent) => {
  if (!locals.user) throw redirect(302, "/");

  const db = getDrizzle();

  // Fetch session
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

  // Fetch nodes
  const nodes = await db
    .select()
    .from(agentNode)
    .where(eq(agentNode.sessionId, params.id as string))
    .orderBy(agentNode.sortOrder);

  // Fetch user's API key (server-side, no flicker!)
  const users = await db
    .select({ openrouterApiKey: user.openrouterApiKey })
    .from(user)
    .where(eq(user.id, locals.user.id));

  const accountKeyMasked = users[0]?.openrouterApiKey 
    ? maskKey(users[0].openrouterApiKey) 
    : null;

  return {
    user: locals.user,
    session,
    nodes,
    accountKeyMasked,
  };
};

function maskKey(key: string): string {
  if (key.length <= 8) return '***';
  return key.slice(0, 4) + '****' + key.slice(-4);
}
