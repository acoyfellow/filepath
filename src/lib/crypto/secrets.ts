// Secret encryption utilities for myfilepath.com

// Web Crypto API is available in both browser and Cloudflare Workers

/**
 * Derive a key from a user's ID using PBKDF2
 * In a production environment, you might want to use a more secure method
 * like HKDF with a salt stored per user
 */
async function deriveUserKey(userId: string): Promise<CryptoKey> {
  // In production, use a proper salt stored per user
  const salt = new TextEncoder().encode('myfilepath-salt-prefix-' + userId);
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(userId),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt secrets using a user's derived key
 */
export async function encryptSecrets(userId: string, secrets: Record<string, string>): Promise<string> {
  const key = await deriveUserKey(userId);
  
  // Convert secrets object to string
  const secretsStr = JSON.stringify(secrets);
  const enc = new TextEncoder();
  const data = enc.encode(secretsStr);
  
  // Generate a random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt the data
  const encryptedData = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    data
  );
  
  // Combine IV and encrypted data
  const result = new Uint8Array(iv.length + encryptedData.byteLength);
  result.set(iv);
  result.set(new Uint8Array(encryptedData), iv.length);
  
  // Return as base64 string
  return btoa(String.fromCharCode(...result));
}

/**
 * Decrypt secrets using a user's derived key
 */
export async function decryptSecrets(userId: string, encryptedSecrets: string): Promise<Record<string, string>> {
  const key = await deriveUserKey(userId);
  
  // Convert base64 string to bytes
  const encryptedBytes = Uint8Array.from(atob(encryptedSecrets), c => c.charCodeAt(0));
  
  // Extract IV and encrypted data
  const iv = encryptedBytes.slice(0, 12);
  const data = encryptedBytes.slice(12);
  
  // Decrypt the data
  const decryptedData = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    data
  );
  
  // Convert to string and parse as JSON
  const dec = new TextDecoder();
  const secretsStr = dec.decode(decryptedData);
  
  return JSON.parse(secretsStr);
}

/**
 * Hash an API key for storage/search
 * This is separate from encryption - we still need to hash the key for lookup
 */
export async function hashApiKey(key: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}