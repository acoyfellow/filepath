import { json, error } from '@sveltejs/kit';
import { initAuth, getDrizzle } from '$lib/auth';
import { apikey, user } from '$lib/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

interface OrchestratorRequest {
  sessionId: string;
  task: string;
}

/**
 * Hash an API key using SHA-256 (same as better-auth's default)
 */
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);

  // Base64url encode without padding (matches better-auth)
  const base64 = btoa(String.fromCharCode(...hashArray));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Validate API key by looking it up in the database
 */
async function validateApiKey(key: string): Promise<{
  valid: boolean;
  apiKey?: {
    id: string;
    userId: string;
    name: string | null;
    metadata: unknown;
  };
  user?: {
    id: string;
    creditBalance: number | null;
  };
  error?: string;
}> {
  try {
    const db = getDrizzle();
    const hashedKey = await hashApiKey(key);

    // Find API key by hashed key
    const apiKeys = await db.select().from(apikey).where(eq(apikey.hashedKey, hashedKey));

    if (apiKeys.length === 0) {
      return { valid: false, error: 'Invalid API key' };
    }

    const foundKey = apiKeys[0];

    // Check if key is expired
    if (foundKey.expiresAt && new Date(foundKey.expiresAt) < new Date()) {
      return { valid: false, error: 'API key expired' };
    }

    // Get the user associated with this API key
    const users = await db.select().from(user).where(eq(user.id, foundKey.userId));

    if (users.length === 0) {
      return { valid: false, error: 'User not found' };
    }

    const foundUser = users[0];

    // Update last used timestamp
    await db.update(apikey)
      .set({ lastUsedAt: new Date() })
      .where(eq(apikey.id, foundKey.id));

    return {
      valid: true,
      apiKey: {
        id: foundKey.id,
        userId: foundKey.userId,
        name: foundKey.name,
        metadata: foundKey.metadata,
      },
      user: {
        id: foundUser.id,
        creditBalance: foundUser.creditBalance,
      },
    };
  } catch (err) {
    console.error('[validateApiKey] Error:', err);
    return { valid: false, error: 'Failed to validate API key' };
  }
}

/**
 * POST /api/orchestrator - Execute a task in a sandboxed container
 *
 * Headers:
 *   x-api-key: <api-key>
 *
 * Body:
 *   { "sessionId": "test", "task": "echo hello" }
 *
 * Returns:
 *   { "success": true, "result": "hello" }
 */
export const POST: RequestHandler = async ({ request, platform }) => {
  // Extract API key from headers
  const apiKeyHeader = request.headers.get('x-api-key') || request.headers.get('authorization');

  if (!apiKeyHeader) {
    throw error(401, 'Missing API key. Provide x-api-key header.');
  }

  // Get platform bindings
  const db = platform?.env?.DB;
  const worker = platform?.env?.WORKER;

  if (!db) {
    throw error(503, 'Database not available');
  }

  if (!worker) {
    throw error(503, 'Worker not available');
  }

  // Initialize auth (required for getDrizzle to work)
  initAuth(db, platform?.env, new URL(request.url).origin);

  // Validate the API key
  const validation = await validateApiKey(apiKeyHeader);

  if (!validation.valid || !validation.apiKey) {
    throw error(401, validation.error || 'Invalid API key');
  }

  // Check if user has credits (optional - can be enforced here or in worker)
  if (validation.user && (validation.user.creditBalance === null || validation.user.creditBalance < 100)) {
    throw error(402, 'Insufficient credits. Please add credits to your account.');
  }

  // Parse request body
  let body: OrchestratorRequest;
  try {
    body = await request.json() as OrchestratorRequest;
  } catch {
    throw error(400, 'Invalid JSON body');
  }

  const { sessionId, task } = body;

  if (!sessionId || typeof sessionId !== 'string') {
    throw error(400, 'Missing or invalid sessionId');
  }

  if (!task || typeof task !== 'string') {
    throw error(400, 'Missing or invalid task');
  }

  // Forward task to worker
  try {
    const taskUrl = new URL(request.url);
    taskUrl.pathname = `/task/${sessionId}`;

    const taskRequest = new Request(taskUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task,
        userId: validation.apiKey.userId,
        apiKeyId: validation.apiKey.id,
      }),
    });

    const response = await worker.fetch(taskRequest);
    const result = await response.json() as { success?: boolean; result?: string; error?: string };

    if (!response.ok) {
      throw error(response.status, result.error || 'Task execution failed');
    }

    return json(result);
  } catch (err) {
    if (err instanceof Error && 'status' in err) {
      throw err; // Re-throw SvelteKit errors
    }
    console.error('[orchestrator] Task execution error:', err);
    throw error(500, 'Failed to execute task');
  }
};
