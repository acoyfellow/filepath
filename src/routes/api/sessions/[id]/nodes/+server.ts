import { json, error } from "@sveltejs/kit";
import { createUserContext, runOrThrow } from "../../../../../core/http";
import {
  decodeInput,
  listNodes,
  NodeSpawnInputSchema,
  spawnNode,
} from "../../../../../core/app";
import type { RequestHandler, RequestEvent } from "@sveltejs/kit";

/**
 * GET /api/sessions/[id]/nodes - List all nodes in a session (flat)
 */
export const GET: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  return json(await runOrThrow(listNodes(createUserContext(event), event.params.id!)));
};

/**
 * POST /api/sessions/[id]/nodes - Spawn a new agent node
 * Body: { name, harnessId, model, parentId?, config? }
 */
export const POST: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  const ctx = createUserContext(event);
  const input = await runOrThrow(
    decodeInput(NodeSpawnInputSchema, await event.request.json()),
  );
  return json(await runOrThrow(spawnNode(ctx, event.params.id!, input)), { status: 201 });
};
