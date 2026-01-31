import type { RequestHandler } from './$types';

function sanitizeId(id: string): string {
  return id.replace(/^-+|-+$/g, '').replace(/[^a-z0-9-]/gi, '');
}

export const POST: RequestHandler = async ({ params, platform }) => {
  const { sessionId, tabId } = params;
  
  if (!platform?.env?.WORKER) {
    return new Response(JSON.stringify({ error: 'Worker not available' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const terminalId = `t-${sanitizeId(sessionId)}-${sanitizeId(tabId)}`;
  
  try {
    // Proxy to worker which has the Sandbox binding
    const response = await platform.env.WORKER.fetch(
      new Request(`http://worker/terminal/${terminalId}/start`, {
        method: 'POST'
      })
    );
    
    const result = await response.json();
    
    return new Response(JSON.stringify(result), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[terminal/start]', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to start terminal',
      message: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
