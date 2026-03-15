interface DashboardWsClaimsInput {
  userId: string;
  sessionId: string;
}

interface DashboardWsClaims extends DashboardWsClaimsInput {
  exp: number;
  v: 1;
}

function encodeBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const bytes = Uint8Array.from(Buffer.from(`${normalized}${padding}`, "base64"));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createDashboardWsToken(
  claims: DashboardWsClaimsInput,
  secret: string,
  ttlMs: number,
): Promise<string> {
  const payload: DashboardWsClaims = {
    ...claims,
    exp: Date.now() + ttlMs,
    v: 1,
  };
  const payloadJson = JSON.stringify(payload);
  const payloadEncoded = encodeBase64Url(new TextEncoder().encode(payloadJson));
  const key = await importSigningKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadEncoded),
  );
  return `${payloadEncoded}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifyDashboardWsToken(
  token: string,
  secret: string,
): Promise<DashboardWsClaims | null> {
  const [payloadEncoded, signatureEncoded] = token.split(".");
  if (!payloadEncoded || !signatureEncoded) {
    return null;
  }

  const key = await importSigningKey(secret);
  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    decodeBase64Url(signatureEncoded),
    new TextEncoder().encode(payloadEncoded),
  );
  if (!isValid) {
    return null;
  }

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(payloadEncoded)),
    ) as DashboardWsClaims;
    if (payload.v !== 1 || payload.exp <= Date.now()) {
      return null;
    }
    if (!payload.userId || !payload.sessionId) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
