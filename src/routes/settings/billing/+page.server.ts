import { error, redirect } from '@sveltejs/kit';
import { getUserCreditBalance, getUserApiKeysWithCredits } from '$lib/billing';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    redirect(302, '/login');
  }
  
  try {
    const balance = await getUserCreditBalance(locals.user.id);
    const apiKeys = await getUserApiKeysWithCredits(locals.user.id);
    
    return {
      balance,
      apiKeys
    };
  } catch (err) {
    console.error('Error loading billing data:', err);
    throw error(500, 'Failed to load billing data');
  }
};

export const actions: Actions = {
  // Actions can be added here for server-side form handling
};
