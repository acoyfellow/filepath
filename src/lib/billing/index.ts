import type { D1Database } from '@cloudflare/workers-types';
import type { ApiKey } from '../schema';
import { eq, gte, and, sql } from 'drizzle-orm';
import { apikey, user } from '../schema';

// Constants
const CREDIT_PER_MINUTE = 1; // $0.01 per minute = 1 credit per minute

export class BillingService {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * Check if an API key has sufficient credits and is within budget cap
   */
  async checkQuota(apiKeyId: string): Promise<{ allowed: boolean; message?: string }> {
    try {
      const key = await this.db.select().from(apikey).where(eq(apikey.id, apiKeyId)).get();
      
      if (!key) {
        return { allowed: false, message: 'API key not found' };
      }

      // Check if key has a budget cap and if it's exceeded
      if (key.budgetCap !== null && key.budgetCap > 0) {
        if (key.creditBalance >= key.budgetCap) {
          return { allowed: false, message: 'API key budget cap exceeded' };
        }
      }

      // Check if user has sufficient credits
      const userRecord = await this.db.select().from(user).where(eq(user.id, key.userId)).get();
      if (!userRecord) {
        return { allowed: false, message: 'User not found' };
      }

      if (userRecord.creditBalance <= 0) {
        return { allowed: false, message: 'Insufficient credits' };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error checking quota:', error);
      return { allowed: false, message: 'Failed to check quota' };
    }
  }

  /**
   * Deduct credits for usage
   */
  async deductCredits(apiKeyId: string, minutes: number): Promise<boolean> {
    try {
      const creditsToDeduct = minutes * CREDIT_PER_MINUTE;
      
      // Get current API key and user info
      const key = await this.db.select().from(apikey).where(eq(apikey.id, apiKeyId)).get();
      if (!key) return false;
      
      const userRecord = await this.db.select().from(user).where(eq(user.id, key.userId)).get();
      if (!userRecord) return false;

      // Check if deduction would exceed budget cap
      if (key.budgetCap !== null && key.budgetCap > 0) {
        const newBalance = key.creditBalance + creditsToDeduct;
        if (newBalance > key.budgetCap) {
          return false; // Would exceed budget cap
        }
      }

      // Perform deductions in a transaction-like manner
      // Update API key credit balance
      await this.db.update(apikey)
        .set({
          creditBalance: key.creditBalance + creditsToDeduct,
          totalUsageMinutes: key.totalUsageMinutes + minutes,
          lastBilledAt: new Date().getTime(),
        })
        .where(eq(apikey.id, apiKeyId));

      // Update user credit balance
      await this.db.update(user)
        .set({
          creditBalance: Math.max(0, userRecord.creditBalance - creditsToDeduct),
        })
        .where(eq(user.id, key.userId));

      return true;
    } catch (error) {
      console.error('Error deducting credits:', error);
      return false;
    }
  }

  /**
   * Add credits to user's balance
   */
  async addCredits(userId: string, credits: number): Promise<boolean> {
    try {
      await this.db.update(user)
        .set({
          creditBalance: sql`credit_balance + ${credits}`,
        })
        .where(eq(user.id, userId));
      
      return true;
    } catch (error) {
      console.error('Error adding credits:', error);
      return false;
    }
  }

  /**
   * Get user's credit balance
   */
  async getUserBalance(userId: string): Promise<number> {
    try {
      const userRecord = await this.db.select().from(user).where(eq(user.id, userId)).get();
      return userRecord?.creditBalance || 0;
    } catch (error) {
      console.error('Error getting user balance:', error);
      return 0;
    }
  }

  /**
   * Get API key's credit balance and usage
   */
  async getApiKeyUsage(apiKeyId: string): Promise<{ creditBalance: number; totalUsageMinutes: number; budgetCap: number | null } | null> {
    try {
      const key = await this.db.select().from(apikey).where(eq(apikey.id, apiKeyId)).get();
      if (!key) return null;
      
      return {
        creditBalance: key.creditBalance,
        totalUsageMinutes: key.totalUsageMinutes,
        budgetCap: key.budgetCap,
      };
    } catch (error) {
      console.error('Error getting API key usage:', error);
      return null;
    }
  }
}
