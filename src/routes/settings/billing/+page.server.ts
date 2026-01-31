import { fail } from '@sveltejs/kit';
import { getUserCreditBalance, getUserApiKeysWithCredits } from '$lib/billing';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    return { status: 401, error: new Error('Unauthorized') };
  }
  const session = { user: locals.user };
  
  try {
    const balance = await getUserCreditBalance(session.user.id);
    const apiKeys = await getUserApiKeysWithCredits(session.user.id);
    
    return {
      balance,
      apiKeys
    };
  } catch (err) {
    console.error('Error loading billing data:', err);
    return { status: 500, error: new Error('Failed to load billing data') };
  }
};

export const actions: Actions = {
  // Actions can be added here for server-side form handling
};