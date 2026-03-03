import { json, error } from '@sveltejs/kit';
import { getDrizzle } from '$lib/auth';
import { apikey } from '$lib/schema';
import { and, eq } from 'drizzle-orm';
import { encryptSecrets } from '$lib/crypto/secrets';
import type { RequestHandler } from './$types';

function getServerSecret(platform: App.Platform | undefined): string | undefined {
  const platformSecret =
    platform?.env && 'BETTER_AUTH_SECRET' in platform.env
      ? platform.env.BETTER_AUTH_SECRET
      : undefined;

  if (typeof platformSecret === 'string' && platformSecret) {
    return platformSecret;
  }

  const processSecret = process.env.BETTER_AUTH_SECRET;
  return typeof processSecret === 'string' && processSecret ? processSecret : undefined;
}

function parseMetadata(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  if (typeof raw !== 'string') return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ...(parsed as Record<string, unknown>) };
    }
  } catch {
    // Fall through to empty metadata for malformed rows.
  }

  return {};
}

export const POST: RequestHandler = async ({ request, locals, platform }) => {
  if (!locals.user) throw error(401, 'Unauthorized');

  const body = (await request.json()) as {
    keyId?: string;
    secrets?: Record<string, string>;
  };

  const keyId = body.keyId?.trim();
  if (!keyId) {
    throw error(400, 'keyId is required');
  }

  const secrets = body.secrets ?? {};
  for (const [key, value] of Object.entries(secrets)) {
    if (!key.trim() || typeof value !== 'string') {
      throw error(400, 'Invalid secrets payload');
    }
  }

  const db = getDrizzle();
  const rows = await db
    .select({
      id: apikey.id,
      referenceId: apikey.referenceId,
      metadata: apikey.metadata,
    })
    .from(apikey)
    .where(
      and(
        eq(apikey.id, keyId),
        eq(apikey.referenceId, locals.user.id),
      ),
    )
    .limit(1);

  const keyRow = rows[0];
  if (!keyRow) {
    throw error(404, 'API key not found');
  }

  const serverSecret = getServerSecret(platform);
  if (!serverSecret) {
    throw error(500, 'Server misconfigured');
  }

  const metadata = parseMetadata(keyRow.metadata);
  delete metadata.secrets;

  const normalizedSecrets = Object.fromEntries(
    Object.entries(secrets)
      .map(([key, value]) => [key.trim(), value.trim()])
      .filter(([key, value]) => key && value),
  );

  const encryptedSecrets =
    Object.keys(normalizedSecrets).length > 0
      ? await encryptSecrets(serverSecret, keyRow.referenceId, normalizedSecrets)
      : null;

  await db
    .update(apikey)
    .set({
      encryptedSecrets,
      metadata: JSON.stringify(metadata),
    })
    .where(eq(apikey.id, keyRow.id));

  return json({ ok: true });
};
