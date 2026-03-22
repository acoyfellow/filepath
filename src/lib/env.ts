/**
 * Environment Variable Security Utilities
 * 
 * Handles:
 * - Validation of env var keys (UPPER_SNAKE_CASE)
 * - Encryption/decryption of secrets at rest
 * - Log sanitization to prevent secret leakage
 * - Parent env var inheritance
 */

import { z } from 'zod';

// ================================================================
// Schema Validation
// ================================================================

/** Schema for a single env var entry */
export const EnvVarEntrySchema = z.object({
  key: z.string()
    .min(1, 'Key cannot be empty')
    .max(256, 'Key too long')
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Must be UPPER_SNAKE_CASE'),
  value: z.string().max(10000, 'Value too long'),
  sensitive: z.boolean().default(true),  // Auto-mark keys with KEY/SECRET/TOKEN as sensitive
});

/** Schema for user-defined env vars in agent config */
export const AgentEnvVarsSchema = z.record(z.string(), z.string());

/**
 * Validate env var key format
 * @throws ZodError if invalid
 */
export function validateEnvVarKey(key: string): void {
  EnvVarEntrySchema.shape.key.parse(key);
}

/**
 * Validate all env vars in a config object
 * @throws ZodError if any key is invalid
 */
export function validateEnvVars(envVars: Record<string, string>): Record<string, string> {
  // Validate each key
  for (const key of Object.keys(envVars)) {
    validateEnvVarKey(key);
  }
  return envVars;
}

/**
 * Check if a key should be treated as sensitive
 */
export function isSensitiveKey(key: string): boolean {
  const upper = key.toUpperCase();
  return upper.includes('KEY') || 
         upper.includes('SECRET') || 
         upper.includes('TOKEN') || 
         upper.includes('PASSWORD') ||
         upper.includes('CREDENTIAL');
}

// ================================================================
// Encryption (AES-GCM)
// ================================================================

/** Encryption key derived from BETTER_AUTH_SECRET */
let encryptionKey: CryptoKey | null = null;

/**
 * Initialize encryption key from auth secret
 * Must be called at startup with a 32+ char secret
 */
export async function initEncryption(secret: string): Promise<void> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret.slice(0, 32).padEnd(32, '0')),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  // Use static salt for deterministic encryption (OK for this use case)
  const salt = encoder.encode('filepath-env-vars');
  
  encryptionKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a secret value
 * @throws Error if encryption not initialized
 */
export async function encryptSecret(value: string): Promise<string> {
  if (!encryptionKey) {
    throw new Error('Encryption not initialized. Call initEncryption() first.');
  }
  
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    encoder.encode(value)
  );
  
  // Combine IV + ciphertext and base64 encode
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a secret value
 * @throws Error if encryption not initialized
 */
export async function decryptSecret(encrypted: string): Promise<string> {
  if (!encryptionKey) {
    throw new Error('Encryption not initialized. Call initEncryption() first.');
  }
  
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    ciphertext
  );
  
  return new TextDecoder().decode(decrypted);
}

// ================================================================
// Log Sanitization
// ================================================================

/**
 * Patterns that indicate sensitive data
 */
const SENSITIVE_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /token/i,
  /password/i,
  /credential/i,
  /auth/i,
];

/**
 * Check if a string likely contains sensitive data
 */
export function looksLikeSecret(value: string): boolean {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(value));
}

/**
 * Sanitize env vars for logging - masks sensitive values
 */
export function sanitizeEnvForLogging(env: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(env)) {
    if (isSensitiveKey(key) || looksLikeSecret(key)) {
      // Show first 4 chars if value is long enough, else mask entirely
      sanitized[key] = value.length > 8 ? `${value.slice(0, 4)}...${'*'.repeat(8)}` : '***REDACTED***';
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Safe console.log wrapper that sanitizes env vars
 */
export function safeLogEnv(label: string, env: Record<string, string>): void {
  console.log(label, sanitizeEnvForLogging(env));
}

// ================================================================
// Parent Env Var Inheritance
// ================================================================

/**
 * Merge parent env vars with child env vars
 * Child values override parent values for the same key
 * 
 * @param parentVars - Env vars from parent agent (or system defaults)
 * @param childVars - Env vars defined on child agent
 * @param inheritMode - If false, child starts with empty env (no inheritance)
 */
export function mergeEnvVars(
  parentVars: Record<string, string>,
  childVars: Record<string, string>,
  inheritMode: boolean = true
): Record<string, string> {
  if (!inheritMode) {
    return { ...childVars };
  }
  
  // Start with parent vars
  const merged: Record<string, string> = { ...parentVars };
  
  // Override with child vars
  for (const [key, value] of Object.entries(childVars)) {
    // Allow empty string to clear a parent variable
    if (value === '') {
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }
  
  return merged;
}

/**
 * Filter out sensitive vars from being passed to children
 * Use when you want to inherit non-sensitive vars only
 */
export function filterSensitiveVars(env: Record<string, string>): Record<string, string> {
  const filtered: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(env)) {
    if (!isSensitiveKey(key)) {
      filtered[key] = value;
    }
  }
  
  return filtered;
}
