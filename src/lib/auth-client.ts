import { createAuthClient } from "better-auth/client";
import { apiKeyClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  plugins: [
    apiKeyClient(),
    passkeyClient()
  ]
}); 

export const { signIn, signOut, signUp, useSession, passkey, forgetPassword, resetPassword } = authClient;
