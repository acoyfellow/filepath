import { dev } from '$app/environment';
import type { RequestHandler } from './$types';

async function callWorker(
  platform: App.Platform | undefined,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  if (dev) {
    return fetch(`http://localhost:1337${endpoint}`, options);
  }
  return platform!.env!.WORKER.fetch(new Request(`http://worker${endpoint}`, options));
}

export const GET: RequestHandler = async ({ params, request, platform }) => {
  const { id } = params;

  if (!id) {
    return Response.json({ error: 'Session ID is required' }, { status: 400 });
  }

  // Check if WebSocket upgrade
  if (request.headers.get('Upgrade') === 'websocket') {
    const response = await callWorker(platform, `/api/terminal/session/${id}`, {
      headers: {
        ...Object.fromEntries(request.headers),
        'Upgrade': 'websocket'
      }
    });
    return response;
  }

  // Regular status check
  const response = await callWorker(platform, `/api/terminal/status/${id}`);
  return response;
};

