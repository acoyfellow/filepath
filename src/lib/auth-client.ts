import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";
import { apiKeyClient } from "@better-auth/api-key/client";
import { passkeyClient } from "@better-auth/passkey/client";

const baseURL = typeof window !== 'undefined' 
  ? window.location.origin 
  : 'http://localhost:5173';

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    apiKeyClient(),
    passkeyClient(),
    emailOTPClient()
  ]
}); 

export const { signIn, signOut, signUp, useSession, passkey } = authClient;

type AuthClientResult<T> = {
  data?: T;
  error?: { message?: string };
};

type ApiKeyListResponse = {
  apiKeys: Array<{
    id: string;
    name: string | null;
    start: string | null;
    prefix: string | null;
    createdAt: string | Date;
    updatedAt: string | Date;
    expiresAt: string | Date | null;
    metadata: Record<string, unknown> | null;
    permissions: Record<string, string[]> | null;
  }>;
  total: number;
};

type ApiKeyCreateRequest = {
  name: string;
  prefix?: string;
  metadata?: Record<string, unknown>;
};

type ApiKeyCreateResponse = {
  id: string;
  key: string;
  name: string | null;
  start: string | null;
  prefix: string | null;
};

type ApiKeyDeleteRequest = {
  keyId: string;
};

async function authApiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<AuthClientResult<T>> {
  try {
    const response = await fetch(`/api/auth${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const payload = await response.json().catch(() => null) as T | { message?: string } | null;
    if (!response.ok) {
      return {
        error: {
          message:
            payload && typeof payload === "object" && "message" in payload
              ? payload.message
              : `Request failed (${response.status})`,
        },
      };
    }
    return { data: payload as T };
  } catch (error) {
    return {
      error: {
        message: error instanceof Error ? error.message : "Request failed",
      },
    };
  }
}

export const apiKeysApi = {
  list(): Promise<AuthClientResult<ApiKeyListResponse>> {
    return authApiRequest<ApiKeyListResponse>("/api-key/list", {
      method: "GET",
    });
  },
  create(payload: ApiKeyCreateRequest): Promise<AuthClientResult<ApiKeyCreateResponse>> {
    return authApiRequest<ApiKeyCreateResponse>("/api-key/create", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  delete(payload: ApiKeyDeleteRequest): Promise<AuthClientResult<{ success: boolean }>> {
    return authApiRequest<{ success: boolean }>("/api-key/delete", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};

export const forgetPasswordEmailOTP = (opts: { email: string }) => authClient.emailOtp.requestPasswordReset(opts);
export const resetPasswordEmailOTP = (opts: { email: string; otp: string; password: string }) => authClient.emailOtp.resetPassword(opts);

export const forgetPassword = forgetPasswordEmailOTP;
