// Only brand what matters for type safety
export type SessionId = string & { readonly __brand: 'SessionId' }
export type PasswordHash = string & { readonly __brand: 'PasswordHash' }

// Request/Response types
export interface CreateSessionRequest {
  agents: string[]
  sessionId?: string  // Optional: if provided, use this ID (persistent)
  password?: string   // Optional: if provided, protect session
}

export interface SessionInfo {
  sessionId: SessionId
  agents: string[]
  createdAt: number
  lastActivity: number
  hasPassword: boolean  // Never return passwordHash to clients
  ttl: number
  timeUntilSleep: number
}

