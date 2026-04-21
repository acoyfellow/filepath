import { json, error } from "@sveltejs/kit";
import type { RequestHandler, RequestEvent } from "@sveltejs/kit";
import { testAiConnection } from "$lib/ai-connections";
import { resolveBetterAuthSecret } from "$lib/better-auth-secret";

/**
 * POST /api/ai/:id/test
 * Pre-flight the connection by sending a tiny ping prompt.
 * Returns { ok, error?, preview?, durationMs }.
 */

export const POST: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  const db = event.platform?.env?.DB;
  if (!db) throw error(500, "Database not available");
  const secret = resolveBetterAuthSecret({
    envSecret: event.platform?.env?.BETTER_AUTH_SECRET,
    baseURL: event.platform?.env?.BETTER_AUTH_URL,
  });
  if (!secret) throw error(500, "Missing BETTER_AUTH_SECRET");

  const result = await testAiConnection(db, secret, event.locals.user.id, event.params.id!);
  return json(result);
};
