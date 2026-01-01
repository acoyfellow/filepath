import type { RequestHandler } from './$types';
import { callWorker } from '$lib/api-utils';

export const POST: RequestHandler = async ({ params, request, platform }) => {
  try {
    const { sessionId, tabId } = params;
    return callWorker(platform, `/terminal/${sessionId}/${tabId}/start`, request);
  } catch (error) {
    console.error('Terminal tab start error:', error);
    return Response.json(
      { error: 'Failed to start terminal tab' },
      { status: 500 }
    );
  }
};

