import { redirect } from '@sveltejs/kit';
import type { ServerLoadEvent } from '@sveltejs/kit';

export const load = async ({ locals }: ServerLoadEvent) => {
  if (!locals.user) {
    throw redirect(302, '/');
  }
  
  return {
    user: locals.user,
  };
};
