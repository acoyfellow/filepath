import { dev } from '$app/environment';
import type { RequestHandler } from './$types';

async function callWorker(
  platform: App.Platform | undefined,
  endpoint: string,
  request: Request
): Promise<Response> {
  if (dev) {
    const url = new URL(request.url);
    const body = request.body ? await request.text() : null;
    return fetch(`http://localhost:1337${endpoint}`, {
      method: request.method,
      headers: request.headers,
      body: body,
    });
  }
  return platform!.env!.WORKER.fetch(new Request(`http://worker${endpoint}`, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  }));
}

export const POST: RequestHandler = async ({ params, request, platform }) => {
  try {
    const { sessionId, tabId } = params;
    return callWorker(platform, `/terminal/${sessionId}/${tabId}/start`, request);
  } catch (error) {
    console.error('Terminal tab start error:', error);
    return Response.json(
      { error: 'Failed to start terminal tab' },
      { status: 500 }
    );
  }
};

