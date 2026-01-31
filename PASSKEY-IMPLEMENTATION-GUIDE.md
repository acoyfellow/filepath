# Passkey Authentication with Better-Auth

## Summary

Better-auth has **built-in passkey support** through a separate plugin package: `@better-auth/passkey`

## Installation

### 1. Install the passkey package

```bash
bun add @better-auth/passkey
```

Current better-auth version: `^1.4.18`
Passkey plugin version: `1.4.18` (matches)

### 2. Update Server Configuration (`src/lib/auth.ts`)

```typescript
import { betterAuth } from 'better-auth';
import { sveltekitCookies } from "better-auth/svelte-kit";
import { apiKey } from 'better-auth/plugins';
import { passkey } from '@better-auth/passkey';  // ADD THIS
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
// ... other imports

export function initAuth(db: D1Database, env: any, baseURL: string) {
  // ... existing code ...
  
  authInstance = betterAuth({
    // ... existing config ...
    plugins: [
      sveltekitCookies(getRequestEvent as any),
      apiKey({ /* existing config */ }),
      // ADD passkey plugin:
      passkey({
        rpID: 'myfilepath.com',  // Your domain (or 'localhost' for dev)
        rpName: 'myfilepath',     // Human-readable name
        // Optional: origin can be inferred from baseURL but can be explicit
        // origin: 'https://myfilepath.com',
      }),
    ],
  });
}
```

### 3. Update Client Configuration (`src/lib/auth-client.ts`)

```typescript
import { createAuthClient } from "better-auth/client";
import { apiKeyClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";  // ADD THIS

export const authClient = createAuthClient({
  plugins: [
    apiKeyClient(),
    passkeyClient()  // ADD THIS
  ]
});

export const { signIn, signOut, signUp, useSession } = authClient;
```

### 4. Run Database Migration

The passkey plugin requires a new `passkey` table:

```bash
bunx @better-auth/cli migrate
# OR generate schema:
bunx @better-auth/cli generate
```

#### Passkey Table Schema

| Field Name    | Type     | Description                                    |
|---------------|----------|------------------------------------------------|
| id            | string   | Primary key, unique identifier for each passkey|
| name          | string?  | Optional name for the passkey                  |
| publicKey     | string   | The public key of the passkey                  |
| userId        | string   | Foreign key to user                            |
| credentialID  | string   | Unique identifier of the registered credential |
| counter       | number   | Counter to prevent replay attacks              |
| deviceType    | string   | Type of device (platform/cross-platform)       |
| backedUp      | boolean  | Whether the passkey is backed up               |
| transports    | string?  | Transports used to register the passkey        |
| createdAt     | Date?    | Creation timestamp                             |
| aaguid        | string?  | Authenticator's Attestation GUID               |

## Client-Side Usage

### Register a Passkey (for logged-in users)

```typescript
const { data, error } = await authClient.passkey.addPasskey({
  name: "My MacBook Touch ID",  // Optional
  authenticatorAttachment: "platform",  // or "cross-platform"
});
```

### Sign In with Passkey

```typescript
const { data, error } = await authClient.signIn.passkey({
  autoFill: true,  // Enable browser autofill/Conditional UI
});

// With callbacks:
await authClient.signIn.passkey({
  autoFill: true,
  fetchOptions: {
    onSuccess(context) {
      window.location.href = "/dashboard";
    },
    onError(context) {
      console.error("Authentication failed:", context.error.message);
    }
  }
});
```

### List User's Passkeys

```typescript
const { data: passkeys, error } = await authClient.passkey.listUserPasskeys();
```

### Delete a Passkey

```typescript
const { data, error } = await authClient.passkey.deletePasskey({
  id: "passkey-id",
});
```

### Update Passkey Name

```typescript
const { data, error } = await authClient.passkey.updatePasskey({
  id: "passkey-id",
  name: "New Name",
});
```

## Conditional UI (Browser Autofill)

For the best UX with passkeys, implement Conditional UI:

### 1. Add `webauthn` to input autocomplete

```html
<label for="email">Email:</label>
<input type="email" name="email" autocomplete="username webauthn">

<label for="password">Password:</label>
<input type="password" name="password" autocomplete="current-password webauthn">
```

### 2. Preload passkeys on component mount (Svelte example)

```svelte
<script>
  import { onMount } from 'svelte';
  import { authClient } from '$lib/auth-client';

  onMount(async () => {
    // Check if browser supports Conditional UI
    if (!window.PublicKeyCredential?.isConditionalMediationAvailable) {
      return;
    }
    const available = await window.PublicKeyCredential.isConditionalMediationAvailable();
    if (!available) return;
    
    // Preload for autofill
    authClient.signIn.passkey({ autoFill: true });
  });
</script>
```

## Configuration Options

```typescript
passkey({
  // Required for production
  rpID: 'myfilepath.com',  // Your domain without protocol/port
  rpName: 'myfilepath',    // Human-readable name
  
  // Optional
  origin: 'https://myfilepath.com',  // Usually inferred from baseURL
  
  // Authenticator selection criteria
  authenticatorSelection: {
    authenticatorAttachment: 'platform',  // or 'cross-platform'
    residentKey: 'required',  // 'required' | 'preferred' | 'discouraged'
    userVerification: 'preferred',  // 'required' | 'preferred' | 'discouraged'
  },
  
  // Advanced options
  advanced: {
    webAuthnChallengeCookie: 'better-auth-passkey',  // Cookie name for challenge
  },
})
```

### rpID Rules
- For `www.example.com`, valid rpIDs are: `www.example.com` or `example.com`
- Cannot use just `com` (eTLD)
- `localhost` is valid for local development

## API Endpoints (Server)

| Endpoint                          | Method | Description                |
|-----------------------------------|--------|----------------------------|
| `/passkey/add-passkey`            | POST   | Register a new passkey     |
| `/sign-in/passkey`                | POST   | Sign in with passkey       |
| `/passkey/list-user-passkeys`     | GET    | List all user's passkeys   |
| `/passkey/delete-passkey`         | POST   | Delete a passkey           |
| `/passkey/update-passkey`         | POST   | Update passkey name        |

## Notes

- The passkey plugin is powered by [SimpleWebAuthn](https://simplewebauthn.dev/) internally
- Passkeys are phishing-resistant and more secure than passwords
- Users can register multiple passkeys (different devices)
- Passkeys can be used for both primary login and MFA
- For testing, use browser's emulated authenticators (DevTools > More tools > WebAuthn)

## Cloudflare Workers Consideration

Since this project runs on Cloudflare Workers with D1, ensure:
1. The `rpID` and `origin` are properly configured for your worker URLs
2. Test with both `localhost` and production domains
3. The `trustedOrigins` in your better-auth config includes all valid origins
