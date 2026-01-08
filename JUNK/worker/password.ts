import type { PasswordHash } from './types'

// Simple functions, no class needed
export async function hashPassword(password: string): Promise<PasswordHash> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex as PasswordHash
}

export async function verifyPassword(password: string, hash: PasswordHash): Promise<boolean> {
  const computedHash = await hashPassword(password)
  return computedHash === hash
}

