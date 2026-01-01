import { dev } from '$app/environment';

export async function callWorker(
  platform: App.Platform | undefined,
  endpoint: string,
  request?: Request
): Promise<Response> {
  const url = dev ? `http://localhost:1337${endpoint}` : `http://worker${endpoint}`;

  if (!request) {
    if (dev) return fetch(url);
    return platform!.env!.WORKER.fetch(new Request(url));
  }

  // WebSocket upgrades: don't touch the body, just forward headers
  const isWebSocket = request.headers.get('Upgrade')?.toLowerCase() === 'websocket';
  if (isWebSocket) {
    const newRequest = new Request(url, {
      method: request.method,
      headers: request.headers,
    });
    if (dev) return fetch(newRequest);
    return platform!.env!.WORKER.fetch(newRequest);
  }

  // Regular requests: buffer body to avoid stream consumption issues
  const body = request.body ? await request.clone().arrayBuffer() : null;
  const newRequest = new Request(url, {
    method: request.method,
    headers: request.headers,
    body,
  });

  if (dev) return fetch(newRequest);
  return platform!.env!.WORKER.fetch(newRequest);
}

