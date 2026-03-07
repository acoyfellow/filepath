import { json, error } from "@sveltejs/kit";
import { createUserContext, runOrThrow } from "../../../../../core/http";
import { getSessionStatus } from "../../../../../core/app";
import type { RequestHandler, RequestEvent } from "@sveltejs/kit";

/**
 * GET /api/sessions/[id]/status - Real-time status overview
 * Returns session status + all node statuses for tree rendering
 */
export const GET: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  return json(await runOrThrow(getSessionStatus(createUserContext(event), event.params.id!)));
};
