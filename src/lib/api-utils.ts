import { dev } from '$app/environment';

const API_BASE = dev
  ? 'http://localhost:1337'
  : 'https://api.myfilepath.com';

export function getApiUrl(endpoint: string): string {
  // Remove leading slash if present
  const path = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE}/${path}`;
}

// Keep the old callWorker for any server-side usage if needed
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
    // Preserve search params from original URL
    const originalUrl = new URL(request.url);
    const workerUrl = url + originalUrl.search;
    const newRequest = new Request(workerUrl, {
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

