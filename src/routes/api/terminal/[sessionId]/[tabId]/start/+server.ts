import type { RequestHandler } from './$types';
import { getSandbox } from '@cloudflare/sandbox';

function sanitizeId(id: string): string {
  return id.replace(/^-+|-+$/g, '').replace(/[^a-z0-9-]/gi, '');
}

export const POST: RequestHandler = async ({ params, platform }) => {
  const { sessionId, tabId } = params;
  
  if (!platform?.env?.Sandbox) {
    return new Response(JSON.stringify({ error: 'Sandbox not available' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const terminalId = `t-${sanitizeId(sessionId)}-${sanitizeId(tabId)}`;
  
  try {
    console.info('[terminal/start]', { sessionId, tabId, terminalId });
    
    const sandbox = getSandbox(platform.env.Sandbox, terminalId);
    
    // Start ttyd with opencode
    const ttyd = await sandbox.startProcess('ttyd -W -p 7681 opencode');
    
    console.info('[terminal/start]', 'ttyd started', { terminalId });
    
    return new Response(JSON.stringify({ 
      success: true, 
      sessionId, 
      tabId,
      terminalId 
    }), {
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
