import type { LayoutServerLoad } from './$types';
import type { User, Session } from 'better-auth';

export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    user: locals.user as User | null,
    session: locals.session as Session | null,
  };
};