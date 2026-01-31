import type { LayoutServerLoad } from './$types';
import type { user, session } from '$lib/schema';

export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    user: locals.user as typeof user | null,
    session: locals.session as typeof session | null,
  };
};