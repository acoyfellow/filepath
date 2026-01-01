import { dev } from '$app/environment';
import type { RequestHandler } from './$types';

async function callWorker(
  platform: App.Platform | undefined,
  endpoint: string,
  request: Request
): Promise<Response> {
  if (dev) {
    const url = new URL(request.url);
    return fetch(`http://localhost:1337${endpoint}`, {
      method: request.method,
      headers: request.headers,
    });
  }
  return platform!.env!.WORKER.fetch(new Request(`http://worker${endpoint}`, {
    method: request.method,
    headers: request.headers,
  }));
}

export const GET: RequestHandler = async ({ params, request, platform }) => {
  try {
    const { id } = params;
    return callWorker(platform, `/terminal/${id}/ws`, request);
  } catch (error) {
    console.error('Terminal WebSocket error:', error);
    return Response.json(
      { error: 'Failed to connect to terminal' },
      { status: 500 }
    );
  }
};

