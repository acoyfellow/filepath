import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * Public config endpoint — returns environment-dependent configuration
 * that the client needs (worker URL for WebSocket connections, etc.).
 */
export const GET: RequestHandler = ({ url, platform }) => {
  const hostname = url.hostname;
  const apiWsOrigin = platform?.env?.API_WS_ORIGIN;
  const apiWsHost = platform?.env?.API_WS_HOST;

  let workerUrl: string;
  if (apiWsOrigin) {
    workerUrl = apiWsOrigin;
  } else if (apiWsHost) {
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
