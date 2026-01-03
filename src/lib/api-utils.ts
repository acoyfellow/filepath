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

  if (dev) return fetch(request);
  return platform!.env!.WORKER.fetch(request);
}

