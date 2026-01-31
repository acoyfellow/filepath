import type { RequestHandler } from './$types';

function sanitizeId(id: string): string {
  return id.replace(/^-+|-+$/g, '').replace(/[^a-z0-9-]/gi, '');
}

// WebSocket handler - proxies to worker which connects to ttyd via sandbox.wsConnect()
export const GET: RequestHandler = async ({ params, platform, request }) => {
  const { sessionId, tabId } = params;
  
  const upgrade = request.headers.get('Upgrade');
  if (!upgrade || upgrade.toLowerCase() !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 400 });
  }

  if (!platform?.env?.WORKER) {
    return new Response('Worker not available', { status: 500 });
  }

  const terminalId = `t-${sanitizeId(sessionId)}-${sanitizeId(tabId)}`;
  
  try {
    // Forward WebSocket upgrade to worker
    const response = await platform.env.WORKER.fetch(
      new Request(`http://worker/terminal/${terminalId}/ws`, {
        method: 'GET',
        headers: request.headers,
      })
    );
    
    return response;
  } catch (error) {
    console.error('[terminal/ws]', error);
    return new Response('WebSocket connection failed', { status: 502 });
  }
};
