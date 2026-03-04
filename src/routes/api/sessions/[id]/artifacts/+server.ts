import { error, json } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { getDrizzle } from "$lib/auth";
import { agentNode, agentSession } from "$lib/schema";
import type { RequestEvent, RequestHandler } from "@sveltejs/kit";

interface ArtifactRequestBody {
  sourceNodeId: string;
  sourcePath: string;
  targetNodeId: string;
  targetPath: string;
}

async function verifySessionOwnership(
  db: ReturnType<typeof getDrizzle>,
  sessionId: string,
  userId: string,
) {
  const rows = await db
    .select({ id: agentSession.id })
    .from(agentSession)
    .where(and(eq(agentSession.id, sessionId), eq(agentSession.userId, userId)));

  if (rows.length === 0) throw error(404, "Session not found");
}

export const GET: RequestHandler = async ({ params, locals, platform, request }: RequestEvent) => {
  if (!locals.user) throw error(401, "Unauthorized");

  const sessionId = params.id!;
  const db = getDrizzle();
  await verifySessionOwnership(db, sessionId, locals.user.id);
  const worker = platform?.env?.WORKER;
  if (!worker) {
    throw error(503, "Worker binding unavailable");
  }
  const requestUrl = new URL(request.url);
  requestUrl.pathname = `/internal/sessions/${sessionId}/artifacts`;

  const response = await worker.fetch(requestUrl.toString(), {
    method: "GET",
  });
  const payload = (await response.json().catch(() => ({ artifacts: [] }))) as {
    artifacts?: unknown[];
    error?: string;
    message?: string;
  };
  if (!response.ok) {
    throw error(response.status, payload.error || payload.message || "Failed to load artifacts");
  }

  return json({ artifacts: payload.artifacts ?? [] });
};

export const POST: RequestHandler = async ({
  params,
  request,
  locals,
  platform,
}: RequestEvent) => {
  if (!locals.user) throw error(401, "Unauthorized");

  const sessionId = params.id!;
  const body = (await request.json()) as ArtifactRequestBody;
  const db = getDrizzle();
  await verifySessionOwnership(db, sessionId, locals.user.id);

  if (!body.sourceNodeId || !body.targetNodeId || !body.sourcePath || !body.targetPath) {
    throw error(400, "sourceNodeId, sourcePath, targetNodeId, and targetPath are required");
  }
  if (body.sourceNodeId === body.targetNodeId) {
    throw error(400, "Source and target threads must be different");
  }

  const nodes = await db
    .select({
      id: agentNode.id,
      name: agentNode.name,
      containerId: agentNode.containerId,
    })
    .from(agentNode)
    .where(eq(agentNode.sessionId, sessionId));

  const sourceNode = nodes.find((node) => node.id === body.sourceNodeId);
  const targetNode = nodes.find((node) => node.id === body.targetNodeId);
  if (!sourceNode || !targetNode) {
    throw error(404, "Source or target thread not found");
  }
  const worker = platform?.env?.WORKER;
  if (!worker) {
    throw error(503, "Worker binding unavailable");
  }
  const url = new URL(request.url);
  url.pathname = `/internal/sessions/${sessionId}/artifacts`;

  const response = await worker.fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    artifact?: unknown;
    error?: string;
    message?: string;
  };
  if (!response.ok) {
    throw error(response.status, payload.error || payload.message || "Artifact transfer failed");
  }

  return json(payload, { status: response.status });
};
