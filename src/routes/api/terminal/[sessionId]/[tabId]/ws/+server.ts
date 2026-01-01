import type { RequestHandler } from './$types';
import { callWorker } from '$lib/api-utils';

export const GET: RequestHandler = async ({ params, request, platform }) => {
  try {
    const { sessionId, tabId } = params;
    return callWorker(platform, `/terminal/${sessionId}/${tabId}/ws`, request);
  } catch (error) {
    console.error('Terminal tab WebSocket error:', error);
    return Response.json(
      { error: 'Failed to connect to terminal tab' },
      { status: 500 }
    );
  }
};

