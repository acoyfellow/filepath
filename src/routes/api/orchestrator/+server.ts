import { json, error } from '@sveltejs/kit';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { defaultKeyHasher } from '@better-auth/api-key';
import { decryptSecrets } from '$lib/crypto/secrets';
import { apikey } from '$lib/schema';
import type { RequestHandler } from './$types';

interface OrchestratorRequest {
  sessionId: string;
  task: string;
  timeout?: number;
}

interface OrchestratorResponse {
  success: boolean;
  result?: string;
  error?: string;
}

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

async function verifyApiKey(
  db: ReturnType<typeof drizzle>,
  key: string
): Promise<{
  valid: boolean;
  key?: typeof apikey.$inferSelect;
  error?: { message: string };
}> {
  try {
    const hashedKey = await defaultKeyHasher(key);

    const keys = await db
      .select()
      .from(apikey)
      .where(eq(apikey.key, hashedKey))
      .limit(1);

    if (keys.length === 0) {
      return { valid: false, error: { message: 'Invalid API key' } };
    }

    const keyRecord = keys[0];

    if (keyRecord.expiresAt && keyRecord.expiresAt.getTime() < Date.now()) {
      return { valid: false, error: { message: 'API key has expired' } };
    }


    await db
      .update(apikey)
      .set({ lastRequest: new Date() })
      .where(eq(apikey.id, keyRecord.id));

    return { valid: true, key: keyRecord };
  } catch (err) {
    console.error('[orchestrator] Error verifying API key:', err);
    return { valid: false, error: { message: 'Error verifying API key' } };
  }
}

export const POST: RequestHandler = async ({ request, platform }) => {
  const apiKeyHeader = request.headers.get('x-api-key');

  if (!apiKeyHeader) {
    throw error(401, 'Missing x-api-key header');
  }

  let body: OrchestratorRequest;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON body');
  }

  const { sessionId, task, timeout = 30000 } = body;

  if (!sessionId || typeof sessionId !== 'string') {
    throw error(400, 'Missing or invalid sessionId');
  }

  if (!task || typeof task !== 'string') {
    throw error(400, 'Missing or invalid task');
  }

  try {
    const db = platform?.env?.DB;
    if (!db) {
      throw error(500, 'Database not available');
    }

    const drizzleDb = drizzle(db);
    const apiKeyResult = await verifyApiKey(drizzleDb, apiKeyHeader);

    if (!apiKeyResult.valid || !apiKeyResult.key) {
      throw error(401, apiKeyResult.error?.message || 'Invalid API key');
    }

    const keyRecord = apiKeyResult.key;
    const metadata = parseMetadata(keyRecord.metadata);
    let envVars: Record<string, string> = {};

    if ('secrets' in metadata && metadata.secrets != null) {
      throw error(409, 'Legacy API key secrets must be rotated');
    }

    if (keyRecord.encryptedSecrets) {
      const serverSecret = getServerSecret(platform);
      if (!serverSecret) {
        throw error(500, 'Server misconfigured');
      }

      envVars = await decryptSecrets(
        serverSecret,
        keyRecord.referenceId,
        keyRecord.encryptedSecrets,
      );
    }

    const shell =
      typeof metadata.shell === 'string' && metadata.shell
        ? metadata.shell
        : 'bash';
    const defaultDir =
      typeof metadata.defaultDir === 'string' && metadata.defaultDir
        ? metadata.defaultDir
        : '/home/user';

    const worker = platform?.env?.WORKER;
    if (!worker) {
      throw error(500, 'Worker service not available');
    }

    // Call the worker's /api/orchestrator endpoint (TaskAgent DO)
    const taskUrl = new URL(request.url);
    taskUrl.pathname = '/api/orchestrator';

    const taskResponse = await worker.fetch(new Request(taskUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': apiKeyHeader, // Pass through API key for worker validation
      },
      body: JSON.stringify({
        sessionId,
        task,
        timeout,
        env: envVars,
        shell,
        defaultDir,
        apiKeyId: keyRecord.id,
        userId: keyRecord.referenceId,
      }),
    }));

    if (!taskResponse.ok) {
      const errorBody = await taskResponse.text();
      throw error(taskResponse.status, `Task execution failed: ${errorBody}`);
    }

    const result = await taskResponse.json() as OrchestratorResponse;
    return json(result);

  } catch (err) {
    console.error('[orchestrator] Error:', err);

    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }

    throw error(500, err instanceof Error ? err.message : 'Internal server error');
  }
};

export const GET: RequestHandler = async () => {
  return json({
    status: 'ok',
    message: 'Orchestrator is running. Use POST with x-api-key header to execute tasks.'
  });
};
