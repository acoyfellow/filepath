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
      body: request.body,
    });
  }
  return platform!.env!.WORKER.fetch(new Request(`http://worker${endpoint}`, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  }));
}

export const DELETE: RequestHandler = async ({ params, request, platform }) => {
  try {
    const { id } = params;
    return callWorker(platform, `/session/${id}`, request);
  } catch (error) {
    console.error('Session deletion error:', error);
    return Response.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
};

