import type { RequestHandler } from './$types';

function sanitizeId(id: string): string {
  return id.replace(/^-+|-+$/g, '').replace(/[^a-z0-9-]/gi, '');
}

export const GET: RequestHandler = async ({ params, platform, request }) => {
  const { sessionId, tabId } = params;
  
  if (!platform?.env?.WORKER) {
    return new Response('Worker not available', { status: 500 });
  }

  const terminalId = `t-${sanitizeId(sessionId)}-${sanitizeId(tabId)}`;
  const url = new URL(request.url);
  const path = url.pathname.replace(`/terminal/${sessionId}/${tabId}`, '') || '/';
  
  try {
    // Proxy to worker which handles the sandbox
    const response = await platform.env.WORKER.fetch(
      new Request(`http://worker/terminal/${terminalId}/proxy${path}${url.search}`, {
        method: request.method,
        headers: request.headers,
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
