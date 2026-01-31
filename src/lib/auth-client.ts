import { createAuthClient } from "better-auth/client";
import { apiKeyClient, emailOTPClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  plugins: [
    apiKeyClient(),
    passkeyClient(),
    emailOTPClient()
  ]
}); 

export const { signIn, signOut, signUp, useSession, passkey } = authClient;

// Password reset functions are accessed through the client proxy
export const requestPasswordReset = authClient["request-password-reset"];
export const resetPassword = authClient["reset-password"];

// Email OTP functions
export const forgetPassword = authClient["forget-password"]["email-otp"];
