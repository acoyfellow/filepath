import { createAuthClient } from "better-auth/client";
import { apiKeyClient, emailOTPClient } from "better-auth/client/plugins";
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

// @ts-ignore - dynamic proxy methods
export const forgetPasswordEmailOTP = (opts: { email: string }) => authClient.emailOtp.requestPasswordReset(opts);
// @ts-ignore
export const resetPasswordEmailOTP = (opts: { email: string; otp: string; password: string }) => authClient.emailOtp.resetPassword(opts);

export const forgetPassword = forgetPasswordEmailOTP;
