import { json, error } from "@sveltejs/kit";
import { getDrizzle } from "$lib/auth";
import { agentNode, agentSession } from "$lib/schema";
import { and, eq } from "drizzle-orm";
import type { RequestEvent, RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = async ({
  params,
  locals,
  request,
  platform,
}: RequestEvent) => {
  if (!locals.user) throw error(401, "Unauthorized");

  const sessionId = params.id!;
  const nodeId = params.nodeId!;
  const db = getDrizzle();

  const rows = await db
    .select({
      containerId: agentNode.containerId,
      nodeName: agentNode.name,
    })
    .from(agentNode)
    .innerJoin(agentSession, eq(agentNode.sessionId, agentSession.id))
    .where(
      and(
        eq(agentNode.id, nodeId),
        eq(agentNode.sessionId, sessionId),
        eq(agentSession.userId, locals.user.id),
      ),
    );

  if (rows.length === 0) throw error(404, "Thread not found");

  const containerId = rows[0].containerId;
  if (!containerId) {
    return json({ processes: [] });
  }

  const worker = platform?.env?.WORKER;
  if (!worker) {
    return json({ processes: [], error: "Worker binding unavailable" }, { status: 503 });
  }

  const url = new URL(request.url);
  url.pathname = `/internal/sessions/${sessionId}/nodes/${nodeId}/processes`;
  const response = await worker.fetch(new Request(url, request));
  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
};
