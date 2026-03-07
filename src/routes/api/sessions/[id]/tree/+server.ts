import { json, error } from "@sveltejs/kit";
import { createUserContext, runOrThrow } from "../../../../../core/http";
import { getSession } from "../../../../../core/app";
import type { RequestHandler, RequestEvent } from "@sveltejs/kit";

/**
 * GET /api/sessions/[id]/tree - Full tree with statuses
 */
export const GET: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  const result = await runOrThrow(getSession(createUserContext(event), event.params.id!));
  return json({ tree: result.tree });
};
