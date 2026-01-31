import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDrizzle } from '$lib/auth';
import { BillingService } from '$lib/billing';
import { stripeService } from '$lib/stripe';
import { user, apikey } from '$lib/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized');
  }

  const db = getDrizzle();
  const billingService = new BillingService(db);
  
  const body = await request.json();
  const { action, ...params } = body;
  
  try {
    switch (action) {
      case 'purchaseCredits':
        return await handlePurchaseCredits(params, locals.user.id, locals.user.email);
      
      case 'getBalance':
        return await handleGetBalance(locals.user.id, db);
      
      case 'setBudgetCap':
        return await handleSetBudgetCap(params, locals.user.id, db);
      
      default:
        throw error(400, 'Invalid action');
    }
  } catch (err) {
    console.error('Billing API error:', err);
    throw error(500, 'Internal server error');
  }
};

async function handlePurchaseCredits(params: any, userId: string, userEmail: string) {
  const { credits } = params;
  
  if (!credits || credits < 1000) {
    throw error(400, 'Minimum 1000 credits required');
  }
  
  // Create Stripe checkout session
  const sessionUrl = await stripeService.createCheckoutSession({
    userId,
    userEmail,
    credits,
    successUrl: 'https://myfilepath.com/settings/billing/success',
    cancelUrl: 'https://myfilepath.com/settings/billing',
  });
  
  return json({ url: sessionUrl });
}

async function handleGetBalance(userId: string, db: any) {
  // Get user balance
  const userRecord = await db.select().from(user).where(eq(user.id, userId)).get();
  const balance = userRecord?.creditBalance || 0;
  
  // Get API keys with their usage
  const apiKeys = await db.select().from(apikey).where(eq(apikey.userId, userId)).all();
  
  return json({
    balance,
    apiKeys: apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      creditBalance: key.creditBalance,
      budgetCap: key.budgetCap,
      totalUsageMinutes: key.totalUsageMinutes,
    }))
  });
}

async function handleSetBudgetCap(params: any, userId: string, db: any) {
  const { apiKeyId, budgetCap } = params;
  
  if (!apiKeyId || budgetCap === undefined) {
    throw error(400, 'API key ID and budget cap required');
  }
  
  // Verify the API key belongs to the user
  const key = await db.select().from(apikey).where(eq(apikey.id, apiKeyId)).get();
  if (!key || key.userId !== userId) {
    throw error(403, 'API key not found or not owned by user');
  }
  
  // Update budget cap
  await db.update(apikey)
    .set({ budgetCap })
    .where(eq(apikey.id, apiKeyId));
  
  return json({ success: true });
}
