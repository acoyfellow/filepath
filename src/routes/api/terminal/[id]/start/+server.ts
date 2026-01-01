import type { RequestHandler } from './$types';
import { callWorker } from '$lib/api-utils';

export const POST: RequestHandler = async ({ params, request, platform }) => {
  try {
    const { id } = params;
    return callWorker(platform, `/terminal/${id}/start`, request);
  } catch (error) {
    console.error('Terminal start error:', error);
    return Response.json(
      { error: 'Failed to start terminal' },
      { status: 500 }
    );
  }
};

