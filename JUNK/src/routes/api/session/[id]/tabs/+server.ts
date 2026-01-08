import type { RequestHandler } from './$types';
import { callWorker } from '$lib/api-utils';

export const GET: RequestHandler = async ({ params, request, platform }) => {
  try {
    const { id } = params;
    return callWorker(platform, `/session/${id}/tabs`, request);
  } catch (error) {
    console.error('Get tabs error:', error);
    return Response.json(
      { error: 'Failed to get tabs' },
      { status: 500 }
    );
  }
};

export const POST: RequestHandler = async ({ params, request, platform }) => {
  try {
    const { id } = params;
    return callWorker(platform, `/session/${id}/tabs`, request);
  } catch (error) {
    console.error('Update tabs error:', error);
    return Response.json(
      { error: 'Failed to update tabs' },
      { status: 500 }
    );
  }
};

