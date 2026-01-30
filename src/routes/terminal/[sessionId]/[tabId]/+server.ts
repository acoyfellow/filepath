import type { RequestHandler } from './$types';
import { getSandbox } from '@cloudflare/sandbox';

function sanitizeId(id: string): string {
  return id.replace(/^-+|-+$/g, '').replace(/[^a-z0-9-]/gi, '');
}

export const GET: RequestHandler = async ({ params, platform, request }) => {
  const { sessionId, tabId } = params;
  
  if (!platform?.env?.Sandbox) {
    return new Response('Sandbox not available', { status: 500 });
  }

  const terminalId = `t-${sanitizeId(sessionId)}-${sanitizeId(tabId)}`;
  
  try {
    const sandbox = getSandbox(platform.env.Sandbox, terminalId);
    
    // Proxy request to ttyd running in sandbox on port 7681
    const url = new URL(request.url);
    const ttydUrl = `http://localhost:7681${url.pathname.replace(`/terminal/${sessionId}/${tabId}`, '')}${url.search}`;
    
    // Check if this is a WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      // For WebSocket, we need to use the sandbox's fetch which handles WS
      return sandbox.fetch(new Request(ttydUrl, {
        headers: request.headers,
      }));
    }
    
    // Regular HTTP request
    const response = await sandbox.fetch(new Request(ttydUrl));
    
    // Clone response with appropriate headers
    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    console.error('[terminal/proxy]', error);
    return new Response('Terminal not available', { status: 502 });
  }
};
