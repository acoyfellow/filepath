import { dev } from '$app/environment';

export async function callWorker(
  platform: App.Platform | undefined,
  endpoint: string,
  request?: Request
): Promise<Response> {
  if (!request) {
    if (dev) return fetch(`http://localhost:1337${endpoint}`);
    return platform!.env!.WORKER.fetch(new Request(`http://worker${endpoint}`));
  }

  // Clone and buffer the body to avoid "can't read from request stream after response" errors
  const body = request.body ? await request.clone().arrayBuffer() : null;
  const url = dev ? `http://localhost:1337${endpoint}` : `http://worker${endpoint}`;
  
  const newRequest = new Request(url, {
    method: request.method,
    headers: request.headers,
    body,
  });

  if (dev) return fetch(newRequest);
  return platform!.env!.WORKER.fetch(newRequest);
}

