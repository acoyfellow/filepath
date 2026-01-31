import { createAuthClient } from "better-auth/client";
import { apiKeyClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    apiKeyClient()
  ]
}); 

export const { signIn, signOut, signUp, useSession } = authClient;
