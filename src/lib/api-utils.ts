import { dev } from '$app/environment';

export async function callWorker(
  platform: App.Platform | undefined,
  endpoint: string,
  request?: Request
): Promise<Response> {
  if (dev) {
    if (request) {
      // Clone request to avoid consuming the body
      const body = request.body ? await request.clone().arrayBuffer() : null;
      return fetch(`http://localhost:1337${endpoint}`, {
        method: request.method,
        headers: request.headers,
        body: body,
      });
    }
    return fetch(`http://localhost:1337${endpoint}`);
  }
  
  // For production, pass the request directly to the worker
  if (request) {
    return platform!.env!.WORKER.fetch(new Request(`http://worker${endpoint}`, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    }));
  }
  return platform!.env!.WORKER.fetch(new Request(`http://worker${endpoint}`));
}

