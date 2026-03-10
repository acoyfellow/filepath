import { json, error } from "@sveltejs/kit";
import { createUserContext, runOrThrow } from "../../../core/http";
import {
  createSession,
  decodeInput,
  listSessions,
  SessionCreateInputSchema,
} from "../../../core/app";
import type { RequestHandler, RequestEvent } from "@sveltejs/kit";

/**
 * GET /api/sessions - List all agent sessions for the authenticated user
 */
export const GET: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  return json(await runOrThrow(listSessions(createUserContext(event))));
};

/**
 * POST /api/sessions - Create a new agent session
 * Body: { name?: string, gitRepoUrl?: string }
 */
export const POST: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  const ctx = createUserContext(event);
  const input = await runOrThrow(
    decodeInput(SessionCreateInputSchema, await event.request.json().catch(() => ({}))),
  );
  return json(await runOrThrow(createSession(ctx, input)), { status: 201 });
};
