import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Public config endpoint — returns environment-dependent configuration
 * that the client needs (worker URL for WebSocket connections, etc.).
 */
export const GET: RequestHandler = async ({ url, platform }) => {
  const hostname = url.hostname;
  const env = platform?.env as Record<string, unknown> | undefined;
  const apiWsHost = env?.API_WS_HOST as string | undefined;

  // Determine worker URL for WebSocket connections to ChatAgent DOs
  let workerUrl: string;
  if (apiWsHost) {
    workerUrl = `https://${apiWsHost}`;
  } else if (hostname === 'myfilepath.com') {
    workerUrl = 'https://api.myfilepath.com';
  } else {
    // Local dev / preview: same origin
    workerUrl = url.origin;
  }

  return json({
    workerUrl,
  });
};
