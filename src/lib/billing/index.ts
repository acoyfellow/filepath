import { and, eq, gt, sql } from 'drizzle-orm';
import { getDrizzle } from '$lib/auth';
import { user, apikey } from '$lib/schema';
import type { user as User, apikey as ApiKey } from '$lib/schema';

/**
 * Add credits to a user's account
 */
export async function addUserCredits(userId: string, credits: number): Promise<void> {
  const db = getDrizzle();
  
  await db.update(user)
    .set({
      creditBalance: sql`${user.creditBalance} + ${credits}`
    })
    .where(eq(user.id, userId));
}

/**
 * Deduct credits from a user's account
 * Returns true if successful, false if insufficient credits
 */
export async function deductUserCredits(userId: string, credits: number): Promise<boolean> {
  const db = getDrizzle();
  
  // First check if user has enough credits
  const users = await db.select().from(user).where(eq(user.id, userId));
  if (users.length === 0 || users[0].creditBalance === null || users[0].creditBalance < credits) {
    return false;
  }
  
  // Deduct credits
  await db.update(user)
    .set({
      creditBalance: sql`${user.creditBalance} - ${credits}`
    })
    .where(eq(user.id, userId));
  
  return true;
}

/**
 * Get a user's credit balance
 */
export async function getUserCreditBalance(userId: string): Promise<number> {
  const db = getDrizzle();
  
  const users = await db.select({
    creditBalance: user.creditBalance
  }).from(user).where(eq(user.id, userId));
  
  return users.length > 0 && users[0].creditBalance !== null ? users[0].creditBalance : 0;
}

/**
 * Set budget cap for an API key
 */
export async function setApiKeyBudgetCap(apiKeyId: string, userId: string, cap: number | null): Promise<void> {
  const db = getDrizzle();
  
  await db.update(apikey)
    .set({
      budgetCap: cap
    })
    .where(and(
      eq(apikey.id, apiKeyId),
      eq(apikey.userId, userId)
    ));
}

/**
 * Deduct credits for API key usage
 * Returns true if successful, false if exceeds budget cap or insufficient credits
 */
export async function deductApiKeyCredits(apiKeyId: string, credits: number): Promise<boolean> {
  const db = getDrizzle();
  
  // Get the API key with user info
  const apiKeys = await db.select({
    id: apikey.id,
    userId: apikey.userId,
    creditBalance: apikey.creditBalance,
    budgetCap: apikey.budgetCap,
    userCreditBalance: user.creditBalance
  })
  .from(apikey)
  .innerJoin(user, eq(apikey.userId, user.id))
  .where(eq(apikey.id, apiKeyId));
  
  if (apiKeys.length === 0) {
    return false;
  }
  
  const apiKey = apiKeys[0];
  
  // Check if API key has enough credits
  if (apiKey.creditBalance === null || apiKey.creditBalance < credits) {
    return false;
  }
  
  // Check if user has enough credits
  if (apiKey.userCreditBalance === null || apiKey.userCreditBalance < credits) {
    return false;
  }
  
  // Check budget cap if set
  if (apiKey.budgetCap !== null && apiKey.creditBalance !== null && apiKey.creditBalance - credits < 0) {
    return false;
  }
  
  // Deduct credits from API key
  await db.update(apikey)
    .set({
      creditBalance: sql`${apikey.creditBalance} - ${credits}`
    })
    .where(eq(apikey.id, apiKeyId));
  
  // Deduct credits from user
  await db.update(user)
    .set({
      creditBalance: sql`${user.creditBalance} - ${credits}`
    })
    .where(eq(user.id, apiKey.userId));
  
  // Update usage minutes
  await db.update(apikey)
    .set({
      totalUsageMinutes: sql`${apikey.totalUsageMinutes} + 1`
    })
    .where(eq(apikey.id, apiKeyId));
  
  return true;
}

/**
 * Get an API key's credit balance
 */
export async function getApiKeyCreditBalance(apiKeyId: string): Promise<number> {
  const db = getDrizzle();
  
  const apiKeys = await db.select({
    creditBalance: apikey.creditBalance
  }).from(apikey).where(eq(apikey.id, apiKeyId));
  
  return apiKeys.length > 0 && apiKeys[0].creditBalance !== null ? apiKeys[0].creditBalance : 0;
}

/**
 * Get API keys with their credit balances for a user
 */
export async function getUserApiKeysWithCredits(userId: string): Promise<typeof ApiKey[]> {
  const db = getDrizzle();
  
  return await db.select().from(apikey).where(eq(apikey.userId, userId));
}