export const LOCAL_DEV_BETTER_AUTH_SECRET = "dev-secret-not-for-production";

function readProcessSecret(): string | undefined {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (typeof secret === "string" && secret.trim()) {
    return secret.trim();
  }

  return undefined;
}

function isLocalBaseUrl(value: string | undefined): boolean {
  return typeof value === "string" && /localhost|127\.0\.0\.1/.test(value);
}

export function resolveBetterAuthSecret(input?: {
  envSecret?: string | undefined;
  baseURL?: string | undefined;
}): string | undefined {
  const envSecret = input?.envSecret?.trim();
  if (envSecret) {
    return envSecret;
  }

  const processSecret = readProcessSecret();
  if (processSecret) {
    return processSecret;
  }

  if (isLocalBaseUrl(input?.baseURL) || isLocalBaseUrl(process.env.BETTER_AUTH_URL)) {
    return LOCAL_DEV_BETTER_AUTH_SECRET;
  }

  return LOCAL_DEV_BETTER_AUTH_SECRET;
}
