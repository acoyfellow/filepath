// Terminal API utilities for myfilepath.com
import { getDrizzle } from '$lib/auth';
import { decryptSecrets } from '$lib/crypto/secrets';
import { apikey } from '$lib/schema';
import { eq } from 'drizzle-orm';

/**
 * Get decrypted secrets for an API key
 * This should only be called when spawning a terminal
 */
export async function getApikeySecrets(apiKeyId: string, userId: string): Promise<Record<string, string> | null> {
  try {
    const db = getDrizzle();
    
    // Get the API key with encrypted secrets
    const keys = await db.select({
      encryptedSecrets: apikey.encryptedSecrets
    }).from(apikey).where(eq(apikey.id, apiKeyId));
    
    if (keys.length === 0) {
      return null;
    }
    
    const { encryptedSecrets } = keys[0];
    
    // If no secrets, return empty object
    if (!encryptedSecrets) {
      return {};
    }
    
    // Decrypt the secrets
    const secrets = await decryptSecrets(userId, encryptedSecrets);
    return secrets;
  } catch (error) {
    console.error('Error decrypting API key secrets:', error);
    return null;
  }
}