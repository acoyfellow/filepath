/**
 * AES-GCM encryption for API keys using Web Crypto API (CF Workers compatible).
 *
 * Keys are stored as base64-encoded `iv:ciphertext` strings.
 * The encryption key is derived from BETTER_AUTH_SECRET via PBKDF2.
 */

const SALT = new TextEncoder().encode("filepath-key-encryption-v1");
const IV_LENGTH = 12;

async function deriveKey(secret: string): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(secret);
  const base = await crypto.subtle.importKey("raw", raw, "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: SALT, iterations: 100_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

/**
 * Encrypt a plaintext API key.
 * Returns a string safe for DB storage: `base64(iv):base64(ciphertext)`
 */
export async function encryptApiKey(
  plaintext: string,
  secret: string,
): Promise<string> {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );
  return `${toBase64(iv.buffer)}:${toBase64(ciphertext)}`;
}

/**
 * Decrypt a stored API key back to plaintext.
 */
export async function decryptApiKey(
  stored: string,
  secret: string,
): Promise<string> {
  const [ivB64, ctB64] = stored.split(":");
  if (!ivB64 || !ctB64) throw new Error("Invalid encrypted key format");

  const key = await deriveKey(secret);
  const iv = toArrayBuffer(fromBase64(ivB64));
  const ciphertext = toArrayBuffer(fromBase64(ctB64));
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(plaintext);
}

/**
 * Mask an API key for display: `sk-or-v1-abcd...wxyz`
 * Shows first 10 chars + last 4 chars.
 */
export function maskApiKey(key: string): string {
  if (key.length <= 14) return key.slice(0, 4) + "****";
  return key.slice(0, 10) + "****" + key.slice(-4);
}
