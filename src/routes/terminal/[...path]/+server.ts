import type { RequestHandler } from './$types';

// Proxy /terminal/* HTTP requests to worker
// WebSocket goes directly to api.myfilepath.com (handled client-side)
export const GET: RequestHandler = async ({ params, request, platform }) => {
  const worker = (platform?.env as any)?.WORKER;
  if (!worker) {
    return new Response('Worker not available', { status: 503 });
  }
  
  const url = new URL(request.url);
  url.pathname = `/terminal/${params.path}`;
  
  return worker.fetch(new Request(url, request));
};

export const POST: RequestHandler = async ({ params, request, platform }) => {
  const worker = (platform?.env as any)?.WORKER;
  if (!worker) {
    return new Response('Worker not available', { status: 503 });
  }
  
  const url = new URL(request.url);
  url.pathname = `/terminal/${params.path}`;
  
  return worker.fetch(new Request(url, request));
};
