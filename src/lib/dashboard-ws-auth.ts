const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface DashboardWsTokenClaims {
  userId: string;
  sessionId: string;
  exp: number;
  v: 1;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function importSecret(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const key = await importSecret(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

export async function createDashboardWsToken(
  input: { userId: string; sessionId: string },
  secret: string,
  ttlMs = 1000 * 60 * 60 * 12,
): Promise<string> {
  const claims: DashboardWsTokenClaims = {
    userId: input.userId,
    sessionId: input.sessionId,
    exp: Date.now() + ttlMs,
    v: 1,
  };

  const payload = toBase64Url(encoder.encode(JSON.stringify(claims)));
  const signature = await signPayload(payload, secret);
  return `${payload}.${signature}`;
}

export async function verifyDashboardWsToken(
  token: string,
  secret: string,
): Promise<DashboardWsTokenClaims | null> {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const key = await importSecret(secret);
  const signatureBytes = fromBase64Url(signature);
  const signatureBuffer = Uint8Array.from(signatureBytes);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBuffer,
    encoder.encode(payload),
  );

  if (!valid) return null;

  let claims: unknown;
  try {
    claims = JSON.parse(decoder.decode(fromBase64Url(payload)));
  } catch {
    return null;
  }

  if (
    !claims ||
    typeof claims !== "object" ||
    !("userId" in claims) ||
    !("sessionId" in claims) ||
    !("exp" in claims) ||
    !("v" in claims)
  ) {
    return null;
  }

  const parsed = claims as Partial<DashboardWsTokenClaims>;
  if (
    typeof parsed.userId !== "string" ||
    typeof parsed.sessionId !== "string" ||
    typeof parsed.exp !== "number" ||
    parsed.v !== 1 ||
    parsed.exp <= Date.now()
  ) {
    return null;
  }

  return parsed as DashboardWsTokenClaims;
}
