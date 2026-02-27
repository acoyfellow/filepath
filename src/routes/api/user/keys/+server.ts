import { json, error } from "@sveltejs/kit";
import { getDrizzle } from "$lib/auth";
import { user } from "$lib/schema";
import { eq } from "drizzle-orm";
import { encryptApiKey, decryptApiKey, maskApiKey } from "$lib/crypto";
import type { RequestHandler } from "@sveltejs/kit";

/**
 * GET /api/user/keys — Retrieve masked provider keys for current user
 */
export const GET: RequestHandler = async ({ locals, platform }) => {
  if (!locals.user) throw error(401, "Unauthorized");

  const db = getDrizzle();
  const rows = await db
    .select({ openrouterApiKey: user.openrouterApiKey })
    .from(user)
    .where(eq(user.id, locals.user.id));

  const row = rows[0];
  if (!row?.openrouterApiKey) {
    return json({ openrouter: null });
  }

  const secret = (platform?.env as Record<string, string>)?.BETTER_AUTH_SECRET;
  if (!secret) throw error(500, "Server misconfigured");

  try {
    const plainKey = await decryptApiKey(row.openrouterApiKey, secret);
    return json({ openrouter: maskApiKey(plainKey) });
  } catch {
    // Corrupted key — clear it
    return json({ openrouter: null });
  }
};

/**
 * POST /api/user/keys — Save provider key
 * Body: { provider: "openrouter", key: "sk-or-..." } or { provider: "openrouter", key: null } to delete
 */
export const POST: RequestHandler = async ({ request, locals, platform }) => {
  if (!locals.user) throw error(401, "Unauthorized");

  const body = (await request.json()) as {
    provider: string;
    key: string | null;
  };

  if (body.provider !== "openrouter") {
    throw error(400, "Only 'openrouter' provider is supported");
  }

  const db = getDrizzle();
  const secret = (platform?.env as Record<string, string>)?.BETTER_AUTH_SECRET;
  if (!secret) throw error(500, "Server misconfigured");

  if (!body.key) {
    // Delete key
    await db
      .update(user)
      .set({ openrouterApiKey: null })
      .where(eq(user.id, locals.user.id));
    return json({ ok: true, masked: null });
  }

  // Validate key format (basic sanity)
  const trimmed = body.key.trim();
  if (trimmed.length < 10) {
    throw error(400, "API key too short");
  }

  // Encrypt and store
  const encrypted = await encryptApiKey(trimmed, secret);
  await db
    .update(user)
    .set({ openrouterApiKey: encrypted })
    .where(eq(user.id, locals.user.id));

  return json({ ok: true, masked: maskApiKey(trimmed) });
};
