import { error, json } from "@sveltejs/kit";
import { and, desc, eq } from "drizzle-orm";
import { getDrizzle } from "$lib/auth";
import { agentArtifact, agentNode, agentSession } from "$lib/schema";
import {
  exportArtifactFromContainer,
  importArtifactToContainer,
  type ContainerEnv,
} from "$lib/agents/container";
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

async function broadcastSessionEvent(
  platform: RequestEvent["platform"],
  sessionId: string,
  payload: Record<string, unknown>,
) {
  const sessionNamespace = platform?.env?.SESSION_DO as any;
  if (!sessionNamespace) return;

  const stub = sessionNamespace.get(sessionNamespace.idFromName(sessionId));
  await stub.fetch("https://session/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export const GET: RequestHandler = async ({ params, locals }: RequestEvent) => {
  if (!locals.user) throw error(401, "Unauthorized");

  const sessionId = params.id!;
  const db = getDrizzle();
  await verifySessionOwnership(db, sessionId, locals.user.id);

  const artifacts = await db
    .select()
    .from(agentArtifact)
    .where(eq(agentArtifact.sessionId, sessionId))
    .orderBy(desc(agentArtifact.createdAt));

  return json({ artifacts });
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
  if (!sourceNode.containerId || !targetNode.containerId) {
    throw error(409, "Both threads need a live runtime before sending files");
  }

  const sandboxBinding = platform?.env?.Sandbox;
  const artifactBucket = platform?.env?.ARTIFACTS;
  if (!sandboxBinding || !artifactBucket) {
    throw error(503, "Sandbox or artifact storage binding unavailable");
  }

  const artifactId = crypto.randomUUID();
  await db.insert(agentArtifact).values({
    id: artifactId,
    sessionId,
    sourceNodeId: sourceNode.id,
    targetNodeId: targetNode.id,
    sourcePath: body.sourcePath,
    targetPath: body.targetPath,
    bucketKey: "",
    status: "staged",
  });

  await broadcastSessionEvent(platform, sessionId, {
    type: "artifact_event",
    action: "artifact_staged",
    artifactId,
    sourceNodeId: sourceNode.id,
    targetNodeId: targetNode.id,
    sourcePath: body.sourcePath,
    targetPath: body.targetPath,
  });

  try {
    const artifactEnv = {
      Sandbox: sandboxBinding,
      ARTIFACTS: artifactBucket,
    } as ContainerEnv & { ARTIFACTS: any };

    const { bucketKey } = await exportArtifactFromContainer(
      artifactEnv,
      sourceNode.containerId,
      sessionId,
      sourceNode.id,
      body.sourcePath,
    );

    await db
      .update(agentArtifact)
      .set({
        bucketKey,
      })
      .where(eq(agentArtifact.id, artifactId));

    await importArtifactToContainer(
      artifactEnv,
      targetNode.containerId,
      bucketKey,
      body.targetPath,
    );

    await db
      .update(agentArtifact)
      .set({
        status: "delivered",
      })
      .where(eq(agentArtifact.id, artifactId));

    await broadcastSessionEvent(platform, sessionId, {
      type: "artifact_event",
      action: "artifact_delivered",
      artifactId,
      sourceNodeId: sourceNode.id,
      targetNodeId: targetNode.id,
      sourcePath: body.sourcePath,
      targetPath: body.targetPath,
    });

    const [artifact] = await db
      .select()
      .from(agentArtifact)
      .where(eq(agentArtifact.id, artifactId));

    return json({ artifact }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Artifact transfer failed";
    await db
      .update(agentArtifact)
      .set({
        status: "failed",
        errorMessage: message,
      })
      .where(eq(agentArtifact.id, artifactId));

    await broadcastSessionEvent(platform, sessionId, {
      type: "artifact_event",
      action: "artifact_failed",
      artifactId,
      sourceNodeId: sourceNode.id,
      targetNodeId: targetNode.id,
      sourcePath: body.sourcePath,
      targetPath: body.targetPath,
      errorMessage: message,
    });

    throw error(500, message);
  }
};
