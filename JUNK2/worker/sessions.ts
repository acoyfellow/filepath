export interface Session {
  id: string;
  createdAt: number;
  passwordHash?: string;
  hasPassword: boolean;
}

const sessions = new Map<string, Session>();

export function createSession(password?: string): Session {
  const id = crypto.randomUUID().slice(0, 8);
  const session: Session = {
    id,
    createdAt: Date.now(),
    hasPassword: !!password,
  };

  if (password) {
    session.passwordHash = hashPassword(password);
  }

  sessions.set(id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function verifyPassword(sessionId: string, password: string): boolean {
  const session = sessions.get(sessionId);
  if (!session || !session.hasPassword) return false;
  if (!session.passwordHash) return false;
  return session.passwordHash === hashPassword(password);
}

function hashPassword(password: string): string {
  return btoa(password);
}

