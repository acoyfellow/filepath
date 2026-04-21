import { json, error } from "@sveltejs/kit";
import type { RequestHandler, RequestEvent } from "@sveltejs/kit";
import {
  createAiConnection,
  listAiConnections,
  PROVIDER_FORMATS,
  isProviderFormat,
} from "$lib/ai-connections";
import { resolveBetterAuthSecret } from "$lib/better-auth-secret";

/**
 * GET  /api/ai         — list the authed user's AI connections (public shape, no keys)
 * POST /api/ai         — create a new AI connection
 */

export const GET: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  const db = event.platform?.env?.DB;
  if (!db) throw error(500, "Database not available");
  const connections = await listAiConnections(db, event.locals.user.id);
  return json({ connections, providerFormats: PROVIDER_FORMATS });
};

export const POST: RequestHandler = async (event: RequestEvent) => {
  if (!event.locals.user) throw error(401, "Unauthorized");
  const db = event.platform?.env?.DB;
  if (!db) throw error(500, "Database not available");
  const secret = resolveBetterAuthSecret({
    envSecret: event.platform?.env?.BETTER_AUTH_SECRET,
    baseURL: event.platform?.env?.BETTER_AUTH_URL,
  });
  if (!secret) throw error(500, "Missing BETTER_AUTH_SECRET");

  const raw = (await event.request.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof raw.provider !== "string" || !isProviderFormat(raw.provider)) {
    return json(
      { error: `provider must be one of: ${PROVIDER_FORMATS.join(", ")}` },
      { status: 400 },
    );
  }
  if (typeof raw.displayName !== "string" || !raw.displayName.trim()) {
    return json({ error: "displayName is required" }, { status: 400 });
  }
  if (typeof raw.model !== "string" || !raw.model.trim()) {
    return json({ error: "model is required" }, { status: 400 });
  }
  if (typeof raw.apiKey !== "string" || !raw.apiKey.trim()) {
    return json({ error: "apiKey is required" }, { status: 400 });
  }

  try {
    const created = await createAiConnection(db, secret, event.locals.user.id, {
      displayName: raw.displayName,
      provider: raw.provider,
      endpoint: typeof raw.endpoint === "string" ? raw.endpoint : undefined,
      model: raw.model,
      apiKey: raw.apiKey,
      maxContextTokens:
        typeof raw.maxContextTokens === "number" ? raw.maxContextTokens : undefined,
      tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : undefined,
      setAsDefault: raw.setAsDefault === true,
    });
    return json({ connection: created }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, { status: 400 });
  }
};
