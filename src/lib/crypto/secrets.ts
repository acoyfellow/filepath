// Secret encryption utilities for myfilepath.com
//
// Web Crypto API is available in both browser and Cloudflare Workers.
// Secrets must be bound to a real server secret, not a predictable user id.

const VERSION = 'v2';
const ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const CONTEXT = 'myfilepath-apikey-secrets';

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function combineBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;

  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }

  return out;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

async function deriveUserKey(
  secret: string,
  userId: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const scopedSalt = combineBytes(
    enc.encode(`${CONTEXT}:${userId}:`),
    salt,
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(scopedSalt),
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt secrets using a server secret scoped to the user.
 */
export async function encryptSecrets(
  secret: string,
  userId: string,
  secrets: Record<string, string>
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const key = await deriveUserKey(secret, userId, salt);
  const secretsStr = JSON.stringify(secrets);
  const enc = new TextEncoder();
  const data = enc.encode(secretsStr);

  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encryptedData = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    data
  );

  return [
    VERSION,
    toBase64(salt),
    toBase64(iv),
    toBase64(new Uint8Array(encryptedData)),
  ].join(':');
}

/**
 * Decrypt secrets using a server secret scoped to the user.
 */
export async function decryptSecrets(
  secret: string,
  userId: string,
  encryptedSecrets: string
): Promise<Record<string, string>> {
  const [version, saltB64, ivB64, ciphertextB64] = encryptedSecrets.split(':');
  if (version !== VERSION || !saltB64 || !ivB64 || !ciphertextB64) {
    throw new Error('Unsupported encrypted secret format');
  }

  const salt = fromBase64(saltB64);
  const iv = fromBase64(ivB64);
  const ciphertext = fromBase64(ciphertextB64);
  const key = await deriveUserKey(secret, userId, salt);

  const decryptedData = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
    },
    key,
    toArrayBuffer(ciphertext)
  );

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
