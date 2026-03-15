import { getDrizzle } from "$lib/auth";
import { decryptApiKey } from "$lib/crypto";
import { PROVIDER_KEYS_UNREADABLE_MESSAGE } from "$lib/provider-key-state";
import { deserializeStoredProviderKeys, getProviderForModel, PROVIDERS } from "$lib/provider-keys";
import { user } from "$lib/schema";
import { eq } from "drizzle-orm";

export function getBetterAuthSecret(platform: App.Platform | undefined): string | undefined {
  const secret =
    platform?.env && "BETTER_AUTH_SECRET" in platform.env
      ? platform.env.BETTER_AUTH_SECRET
      : undefined;
  return typeof secret === "string" ? secret : undefined;
}

export async function ensureProviderKeyForModel(input: {
  userId: string;
  model: string;
  platform: App.Platform | undefined;
}): Promise<{ ok: true } | { status: number; error: string }> {
  const provider = getProviderForModel(input.model);
  const providerDefinition = PROVIDERS[provider];
  const db = getDrizzle();
  const rows = await db
    .select({ openrouterApiKey: user.openrouterApiKey })
    .from(user)
    .where(eq(user.id, input.userId))
    .limit(1);

  const encryptedKeys = rows[0]?.openrouterApiKey;
  if (!encryptedKeys) {
    return {
      status: 400,
      error: `Add a ${providerDefinition.label} key before using this model.`,
    };
  }

  const secret = getBetterAuthSecret(input.platform);
  if (!secret) {
    throw new Error("Server misconfigured");
  }

  try {
    const decrypted = await decryptApiKey(encryptedKeys, secret);
    const providerKeys = deserializeStoredProviderKeys(decrypted);
    if (!providerKeys[provider]) {
      return {
        status: 400,
        error: `Add a ${providerDefinition.label} key before using this model.`,
      };
    }
  } catch {
    return {
      status: 409,
      error: PROVIDER_KEYS_UNREADABLE_MESSAGE,
    };
  }

  return { ok: true };
}
