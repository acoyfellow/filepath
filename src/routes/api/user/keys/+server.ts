import { json, error } from "@sveltejs/kit";
import { getDrizzle } from "$lib/auth";
import { user } from "$lib/schema";
import { eq } from "drizzle-orm";
import { encryptApiKey, decryptApiKey } from "$lib/crypto";
import type { RequestHandler } from "@sveltejs/kit";
import {
  deserializeStoredProviderKeys,
  isProviderId,
  maskProviderKeys,
  type ProviderId,
  type ProviderKeyMap,
  serializeStoredProviderKeys,
  validateProviderApiKey,
} from "$lib/provider-keys";
import {
  buildProviderKeysEnvelope,
  PROVIDER_KEYS_UNREADABLE_MESSAGE,
} from "$lib/provider-key-state";

function getBetterAuthSecret(platform: App.Platform | undefined): string | undefined {
  const secret =
    platform?.env && "BETTER_AUTH_SECRET" in platform.env
      ? platform.env.BETTER_AUTH_SECRET
      : undefined;
  return typeof secret === "string" ? secret : undefined;
}

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
    return json(buildProviderKeysEnvelope({ keys: { openrouter: null, zen: null } }));
  }

  const secret = getBetterAuthSecret(platform);
  if (!secret) throw error(500, "Server misconfigured");

  try {
    const plainValue = await decryptApiKey(row.openrouterApiKey, secret);
    return json(
      buildProviderKeysEnvelope({
        keys: maskProviderKeys(deserializeStoredProviderKeys(plainValue)),
      }),
    );
  } catch {
    return json(
      buildProviderKeysEnvelope({
        keys: { openrouter: null, zen: null },
        unreadable: true,
      }),
    );
  }
};

/**
 * POST /api/user/keys — Save provider key
 * Body: { provider: "openrouter" | "zen", key: "..." } or { key: null } to delete
 */
export const POST: RequestHandler = async ({ request, locals, platform }) => {
  if (!locals.user) throw error(401, "Unauthorized");

  const body = (await request.json()) as {
    provider?: string;
    key?: string | null;
    clearAll?: boolean;
  };

  if (!body.clearAll && !isProviderId(body.provider ?? "")) {
    return json({ status: "invalid", message: "Unsupported provider" }, { status: 400 });
  }
  const provider = body.provider as ProviderId | undefined;

  const db = getDrizzle();
  const secret = getBetterAuthSecret(platform);
  if (!secret) throw error(500, "Server misconfigured");

  const rows = await db
    .select({ openrouterApiKey: user.openrouterApiKey })
    .from(user)
    .where(eq(user.id, locals.user.id));

  let keyMap: ProviderKeyMap = {};
  const existingBlob = rows[0]?.openrouterApiKey;
  let existingBlobUnreadable = false;
  if (existingBlob) {
    try {
      keyMap = deserializeStoredProviderKeys(await decryptApiKey(existingBlob, secret));
    } catch {
      existingBlobUnreadable = true;
    }
  }

  if (body.clearAll) {
    await db
      .update(user)
      .set({ openrouterApiKey: null })
      .where(eq(user.id, locals.user.id));
    return json(
      buildProviderKeysEnvelope({
        keys: { openrouter: null, zen: null },
        message: "Stored model provider keys were cleared.",
      }),
    );
  }

  if (!body.key) {
    const nextKeys = existingBlobUnreadable ? {} : { ...keyMap, [provider!]: undefined };
    const serialized = serializeStoredProviderKeys(nextKeys);
    await db
      .update(user)
      .set({ openrouterApiKey: serialized ? await encryptApiKey(serialized, secret) : null })
      .where(eq(user.id, locals.user.id));
    return json(
      buildProviderKeysEnvelope({
        keys: maskProviderKeys(nextKeys),
        message: existingBlobUnreadable
          ? "Unreadable provider keys were cleared."
          : `${provider} key removed.`,
      }),
    );
  }

  if (existingBlobUnreadable) {
    return json(
      {
        status: "unreadable",
        message: PROVIDER_KEYS_UNREADABLE_MESSAGE,
      },
      { status: 409 },
    );
  }

  const trimmed = body.key.trim();
  try {
    await validateProviderApiKey(provider!, trimmed);
  } catch (validationError) {
    const message =
      validationError instanceof Error ? validationError.message : "API key validation failed";
    return json({ status: "invalid", message }, { status: 400 });
  }

  const nextKeys = { ...keyMap, [provider!]: trimmed };
  const serialized = serializeStoredProviderKeys(nextKeys);
  if (!serialized) {
    return json({ status: "error", message: "Failed to serialize provider keys" }, { status: 500 });
  }

  const encrypted = await encryptApiKey(serialized, secret);
  await db
    .update(user)
    .set({ openrouterApiKey: encrypted })
    .where(eq(user.id, locals.user.id));

  return json(
    buildProviderKeysEnvelope({
      keys: maskProviderKeys(nextKeys),
      message: `${provider} key saved.`,
    }),
  );
};
