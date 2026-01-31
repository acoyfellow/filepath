import type { RequestHandler } from './$types';

function sanitizeId(id: string): string {
  return id.replace(/^-+|-+$/g, '').replace(/[^a-z0-9-]/gi, '');
}

const handler: RequestHandler = async ({ params, platform, request }) => {
  const { sessionId, tabId, path } = params;
  
  if (!platform?.env?.WORKER) {
    return new Response('Worker not available', { status: 500 });
  }

  const terminalId = `t-${sanitizeId(sessionId)}-${sanitizeId(tabId)}`;
  const url = new URL(request.url);
  const proxyPath = path ? `/${path}` : '/';
  
  try {
    // Proxy to worker which handles the sandbox
    const response = await platform.env.WORKER.fetch(
      new Request(`http://worker/terminal/${terminalId}/proxy${proxyPath}${url.search}`, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      })
    );
    
    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    console.error('[terminal/proxy]', error);
    return new Response('Terminal not available', { status: 502 });
  }
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
