import type { LayoutServerLoad } from './$types';
import type { user as User, session as Session } from '$lib/schema';

export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    user: locals.user as User | null,
    session: locals.session as Session | null,
  };
};