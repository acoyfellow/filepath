import type { RequestHandler } from './$types';

// Proxy all /api/session/* requests to the worker's /session/* endpoint
export const GET: RequestHandler = async ({ params, request, platform }) => {
  const worker = platform?.env?.WORKER;
  if (!worker) {
    return new Response('Worker not available', { status: 503 });
  }
  
  const url = new URL(request.url);
  url.pathname = `/session/${params.path}`;
  
  return worker.fetch(new Request(url, request));
};

export const POST: RequestHandler = async ({ params, request, platform }) => {
  const worker = platform?.env?.WORKER;
  if (!worker) {
    return new Response('Worker not available', { status: 503 });
  }
  
  const url = new URL(request.url);
  url.pathname = `/session/${params.path}`;
  
  return worker.fetch(new Request(url, request));
};

export const DELETE: RequestHandler = async ({ params, request, platform }) => {
  const worker = platform?.env?.WORKER;
  if (!worker) {
    return new Response('Worker not available', { status: 503 });
  }
  
  const url = new URL(request.url);
  url.pathname = `/session/${params.path}`;
  
  return worker.fetch(new Request(url, request));
};
