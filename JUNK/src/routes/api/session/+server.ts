import type { RequestHandler } from './$types';
import { callWorker } from '$lib/api-utils';

export const POST: RequestHandler = async ({ request, platform }) => {
  try {
    return callWorker(platform, '/session', request);
  } catch (error) {
    console.error('Session creation error:', error);
    return Response.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
};

