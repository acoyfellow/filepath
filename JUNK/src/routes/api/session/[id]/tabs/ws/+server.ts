import type { RequestHandler } from './$types';
import { callWorker } from '$lib/api-utils';

export const GET: RequestHandler = async ({ params, request, platform }) => {
  try {
    const { id } = params;
    return callWorker(platform, `/session/${id}/tabs/ws`, request);
  } catch (error) {
    console.error('Tab state WebSocket error:', error);
    return Response.json(
      { error: 'Failed to connect to tab state sync' },
      { status: 500 }
    );
  }
};

