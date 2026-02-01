import { json, error } from '@sveltejs/kit';
import { initAuth } from '$lib/auth';
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

export const POST: RequestHandler = async ({ request, platform }) => {
  const apiKey = request.headers.get('x-api-key');

  if (!apiKey) {
    throw error(401, 'Missing x-api-key header');
  }

  try {
    const db = platform?.env?.DB;
    if (!db) {
      throw error(500, 'Database not available');
    }

    const auth = initAuth(db, platform?.env, new URL(request.url).origin);

    const apiKeyResult = await auth.api.verifyApiKey({
      key: apiKey
    });

    if (!apiKeyResult.valid || !apiKeyResult.key) {
      throw error(401, apiKeyResult.error?.message || 'Invalid API key');
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

    const metadata = apiKeyResult.key.metadata as {
      secrets?: Record<string, string>;
      shell?: string;
      defaultDir?: string;
    } | undefined;

    const envVars = metadata?.secrets || {};
    const shell = metadata?.shell || 'bash';
    const defaultDir = metadata?.defaultDir || '/home/user';

    const worker = platform?.env?.WORKER;
    if (!worker) {
      throw error(500, 'Worker service not available');
    }

    // Call worker task endpoint via service binding with internal path
    const taskUrl = new URL(request.url);
    taskUrl.pathname = `/task/${sessionId}`;

    const taskResponse = await worker.fetch(new Request(taskUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task,
        timeout,
        env: envVars,
        shell,
        defaultDir,
        apiKeyId: apiKeyResult.key.id,
        userId: apiKeyResult.key.userId,
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
