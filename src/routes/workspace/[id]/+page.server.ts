import { redirect, error } from "@sveltejs/kit";
import { resolveRuntimeBaseUrl } from "$lib/runtime/http";
import { getDrizzle } from "$lib/auth";
import { workspace, agent } from "$lib/schema";
import { eq, and, desc } from "drizzle-orm";
import type { ServerLoadEvent } from "@sveltejs/kit";
import { listAiConnections } from "$lib/ai-connections";

export const load = async ({ params, locals, platform, url }: ServerLoadEvent) => {
  if (!locals.user) throw redirect(302, "/");

  const db = getDrizzle();

  const workspaces = await db
    .select()
    .from(workspace)
    .where(
      and(eq(workspace.id, params.id as string), eq(workspace.userId, locals.user.id)),
    );

  if (workspaces.length === 0) throw error(404, "Workspace not found");

  const currentWorkspace = workspaces[0];

  const agents = await db
    .select()
    .from(agent)
    .where(eq(agent.workspaceId, params.id as string))
    .orderBy(desc(agent.createdAt), desc(agent.id));

  // Surface the user's configured AI connections (public shape — no keys).
  // The workspace UI needs this to populate the connection picker when
  // creating / editing an agent.
  let aiConnections: Awaited<ReturnType<typeof listAiConnections>> = [];
  const d1 = platform?.env?.DB;
  if (d1) {
    aiConnections = await listAiConnections(d1, locals.user.id);
  }

  const agentBaseUrl = resolveRuntimeBaseUrl({ url, platform });
  return {
    user: locals.user,
    workspace: currentWorkspace,
    agents,
    aiConnections,
    agentBaseUrl,
  };
};
