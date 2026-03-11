import { redirect } from '@sveltejs/kit';
import type { ServerLoadEvent } from '@sveltejs/kit';

export const load = async ({ locals, url }: ServerLoadEvent) => {
  if (!locals.user) {
    const returnTo = url.pathname + url.search;
    throw redirect(302, returnTo ? `/login?redirect=${encodeURIComponent(returnTo)}` : '/login');
  }

  return {
    user: locals.user,
  };
};
