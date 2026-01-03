import type { RequestHandler } from './$types';
import { callWorker } from '$lib/api-utils';

export const POST: RequestHandler = async ({ params, request, platform }) => {
  try {
    const { sessionId, tabId } = params;
    return callWorker(platform, `/terminal/${sessionId}/${tabId}/wake`, request);
  } catch (error) {
    console.error('Terminal wake error:', error);
    return Response.json(
      { error: 'Failed to wake terminal' },
      { status: 500 }
    );
  }
};

