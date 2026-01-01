import type { RequestHandler } from './$types';
import { callWorker } from '$lib/api-utils';

export const GET: RequestHandler = async ({ params, request, platform }) => {
  try {
    const { id } = params;
    return callWorker(platform, `/session/${id}/info`, request);
  } catch (error) {
    console.error('Get session info error:', error);
    return Response.json(
      { error: 'Failed to get session info' },
      { status: 500 }
    );
  }
};

