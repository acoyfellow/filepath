import { json, error } from "@sveltejs/kit";
import { createUserContext, runOrThrow } from "../../../../core/http";
import {
  decodeInput,
  deleteSession,
  getSession,
  SessionUpdateInputSchema,
  updateSession,
} from "../../../../core/app";
import type { RequestHandler, RequestEvent } from "@sveltejs/kit";

/**
 * GET /api/sessions/[id] - Get a single session with its full node tree
 */
export const GET: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  return json(await runOrThrow(getSession(createUserContext(event), event.params.id!)));
};

/**
 * PATCH /api/sessions/[id] - Update session (name, status, etc.)
 */
export const PATCH: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  const ctx = createUserContext(event);
  const input = await runOrThrow(
    decodeInput(SessionUpdateInputSchema, await event.request.json()),
  );
  return json(await runOrThrow(updateSession(ctx, event.params.id!, input)));
};

/**
 * DELETE /api/sessions/[id] - Delete session (cascades to nodes)
 */
export const DELETE: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  return json(await runOrThrow(deleteSession(createUserContext(event), event.params.id!)));
};
