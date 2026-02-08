import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Stub -- API being rewritten for tree architecture */
export const GET: RequestHandler = async () => {
  return json({ error: 'API being rewritten for tree architecture' }, { status: 501 });
};
