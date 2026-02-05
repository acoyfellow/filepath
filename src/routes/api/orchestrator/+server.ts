import { json, error } from '@sveltejs/kit';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
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

// Base64url encode (RFC 4648 §5, no padding)
function base64UrlEncode(data: Uint8Array): string {
  let base64 = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < data.length; i += 3) {
    const b1 = data[i];
    const b2 = data[i + 1] ?? 0;
    const b3 = data[i + 2] ?? 0;
    base64 += chars[b1 >> 2];
    base64 += chars[((b1 & 3) << 4) | (b2 >> 4)];
    if (i + 1 < data.length) base64 += chars[((b2 & 15) << 2) | (b3 >> 6)];
    if (i + 2 < data.length) base64 += chars[b3 & 63];
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_');
}

// Hash API key using same algorithm as better-auth (SHA-256 + base64url)
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hashBuffer));
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
    const hashedKey = await hashApiKey(key);

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

    if (keyRecord.creditBalance !== null && keyRecord.creditBalance <= 0) {
      return { valid: false, error: { message: 'Insufficient credits' } };
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
    const metadata = (keyRecord.metadata || {}) as {
      secrets?: Record<string, string>;
      shell?: string;
      defaultDir?: string;
    };

    const envVars = metadata.secrets || {};
    const shell = metadata.shell || 'bash';
    const defaultDir = metadata.defaultDir || '/home/user';

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
        userId: keyRecord.userId,
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
