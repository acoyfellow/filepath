import { json, error } from "@sveltejs/kit";
import type { RequestHandler, RequestEvent } from "@sveltejs/kit";
import {
  deleteAiConnection,
  getAiConnection,
  isProviderFormat,
  PROVIDER_FORMATS,
  updateAiConnection,
} from "$lib/ai-connections";
import { resolveBetterAuthSecret } from "$lib/better-auth-secret";

/**
 * GET    /api/ai/:id   — get a single connection
 * PATCH  /api/ai/:id   — update a connection (apiKey optional; only rewrites if provided)
 * DELETE /api/ai/:id   — remove a connection (also clears user.defaultAiConnectionId if it pointed here)
 */

export const GET: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  const db = event.platform?.env?.DB;
  if (!db) throw error(500, "Database not available");
  const connection = await getAiConnection(db, event.locals.user.id, event.params.id!);
  if (!connection) return json({ error: "connection not found" }, { status: 404 });
  return json({ connection });
};

export const PATCH: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  const db = event.platform?.env?.DB;
  if (!db) throw error(500, "Database not available");
  const secret = resolveBetterAuthSecret({
    envSecret: event.platform?.env?.BETTER_AUTH_SECRET,
    baseURL: event.platform?.env?.BETTER_AUTH_URL,
  });
  if (!secret) throw error(500, "Missing BETTER_AUTH_SECRET");

  const raw = (await event.request.json().catch(() => ({}))) as Record<string, unknown>;
  if (raw.provider !== undefined && !isProviderFormat(raw.provider)) {
    return json(
      { error: `provider must be one of: ${PROVIDER_FORMATS.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const updated = await updateAiConnection(
      db,
      secret,
      event.locals.user.id,
      event.params.id!,
      {
        displayName: typeof raw.displayName === "string" ? raw.displayName : undefined,
        provider: isProviderFormat(raw.provider) ? raw.provider : undefined,
        endpoint: typeof raw.endpoint === "string" ? raw.endpoint : undefined,
        model: typeof raw.model === "string" ? raw.model : undefined,
        apiKey: typeof raw.apiKey === "string" ? raw.apiKey : undefined,
        maxContextTokens:
          typeof raw.maxContextTokens === "number" ? raw.maxContextTokens : undefined,
        tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : undefined,
        setAsDefault: raw.setAsDefault === true,
      },
    );
    return json({ connection: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = /not found/i.test(message) ? 404 : 400;
    return json({ error: message }, { status });
  }
};

export const DELETE: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  const db = event.platform?.env?.DB;
  if (!db) throw error(500, "Database not available");
  await deleteAiConnection(db, event.locals.user.id, event.params.id!);
  return json({ ok: true });
};
