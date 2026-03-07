import { json, error } from "@sveltejs/kit";
import { createUserContext, runOrThrow } from "../../../../../../core/http";
import {
  decodeInput,
  deleteNode,
  getNode,
  NodeUpdateInputSchema,
  updateNode,
} from "../../../../../../core/app";
import type { RequestHandler, RequestEvent } from "@sveltejs/kit";

/**
 * GET /api/sessions/[id]/nodes/[nodeId] - Get a single node
 */
export const GET: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  return json(await runOrThrow(getNode(createUserContext(event), event.params.id!, event.params.nodeId!)));
};

/**
 * PATCH /api/sessions/[id]/nodes/[nodeId] - Update node (status, config, name, etc.)
 */
export const PATCH: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  const ctx = createUserContext(event);
  const input = await runOrThrow(
    decodeInput(NodeUpdateInputSchema, await event.request.json()),
  );
  return json(await runOrThrow(updateNode(ctx, event.params.id!, event.params.nodeId!, input)));
};

/**
 * DELETE /api/sessions/[id]/nodes/[nodeId] - Delete a node and all descendants
 */
export const DELETE: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  return json(await runOrThrow(deleteNode(createUserContext(event), event.params.id!, event.params.nodeId!)));
};
