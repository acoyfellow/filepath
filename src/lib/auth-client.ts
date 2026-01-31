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
export const { forgetPassword, resetPassword } = authClient.emailOtp;
