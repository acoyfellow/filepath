# Passkey Authentication Implementation Guide for better-auth

## Overview

Passkeys are **NOT** included in the main `better-auth` package. They require a separate plugin package: `@better-auth/passkey`.

The passkey plugin is powered by [SimpleWebAuthn](https://simplewebauthn.dev/) behind the scenes.

## Installation

```bash
# Using bun (matching the beta version of better-auth)
bun add @better-auth/passkey@beta

# Or for the stable version
bun add @better-auth/passkey
```

## Server Setup (auth.ts)

```typescript
import { betterAuth } from "better-auth"
import { passkey } from "@better-auth/passkey"

export const auth = betterAuth({
    plugins: [
        passkey({
            // Required options
            rpID: "localhost", // or your domain like "example.com"
            rpName: "My App",  // Human-readable title
            origin: "http://localhost:8787", // Your server origin

            // Optional: authenticator selection
            authenticatorSelection: {
                // "platform" = fingerprint reader, Face ID, etc.
                // "cross-platform" = security keys
                // Default: not set (both allowed, platform preferred)
                authenticatorAttachment: "platform",
                
                // Credential storage behavior
                // "required" = highest security
                // "preferred" = encouraged but not mandatory
                // "discouraged" = fastest experience
                residentKey: "preferred", // default
                
                // Biometric/PIN verification
                // "required" = highest security
                // "preferred" = encouraged
                // "discouraged" = fastest experience
                userVerification: "preferred", // default
            },
        }),
    ],
})
```

## Client Setup (auth-client.ts)

```typescript
import { createAuthClient } from "better-auth/client"
import { passkeyClient } from "@better-auth/passkey/client"

export const authClient = createAuthClient({
    plugins: [
        passkeyClient()
    ]
})
```

## Database Schema

The plugin requires a new `passkey` table with the following fields:

| Field Name     | Type    | Description                                      |
|----------------|---------|--------------------------------------------------|
| id             | string  | Primary key - Unique identifier                  |
| name           | string  | The name of the passkey                          |
| publicKey      | string  | The public key of the passkey                    |
| userId         | string  | Foreign key - The ID of the user                 |
| credentialID   | string  | The unique credential identifier                 |
| counter        | number  | The counter of the passkey                       |
| deviceType     | string  | The type of device used to register              |
| backedUp       | boolean | Whether the passkey is backed up                 |
| transports     | string  | The transports used to register                  |
| createdAt      | Date    | The time when the passkey was created            |
| aaguid         | string  | Authenticator Attestation GUID                   |

Run the migration to create this table:
```bash
npx @better-auth/cli migrate
```

Or generate the schema manually:
```bash
npx @better-auth/cli generate
```

## Usage

### Register a Passkey (user must be authenticated)

```typescript
const { data, error } = await authClient.passkey.addPasskey({
    name: "My Passkey",
    authenticatorAttachment: "cross-platform", // optional
})
```

### Sign In with Passkey

```typescript
const { data, error } = await authClient.signIn.passkey({
    autoFill: true, // Enable browser autofill / Conditional UI
})
```

### List User Passkeys

```typescript
const { data: passkeys, error } = await authClient.passkey.listUserPasskeys()
```

### Delete a Passkey

```typescript
const { data, error } = await authClient.passkey.delete({
    id: "passkey-id"
})
```

### Update Passkey Name

```typescript
const { data, error } = await authClient.passkey.update({
    id: "passkey-id",
    name: "New Name"
})
```

## API Endpoints

| Method | Endpoint                      | Description                |
|--------|-------------------------------|----------------------------|
| POST   | /passkey/add-passkey          | Register a new passkey     |
| POST   | /sign-in/passkey              | Sign in with a passkey     |
| GET    | /passkey/list-user-passkeys   | List all user passkeys     |
| POST   | /passkey/delete               | Delete a passkey           |
| POST   | /passkey/update               | Update passkey name        |

## Conditional UI (Browser Autofill)

For passkey autofill to work, add `autocomplete="webauthn"` to your username/email input:

```html
<input 
    type="email" 
    name="email" 
    autocomplete="username webauthn"
/>
```

Then call sign-in with autoFill enabled:

```typescript
await authClient.signIn.passkey({ autoFill: true })
```

## Example Configuration for Cloudflare Workers

```typescript
// auth.ts
import { betterAuth } from "better-auth"
import { passkey } from "@better-auth/passkey"

export const auth = betterAuth({
    // ... other config
    plugins: [
        passkey({
            rpID: process.env.NODE_ENV === "production" 
                ? "myapp.com" 
                : "localhost",
            rpName: "My App",
            origin: process.env.NODE_ENV === "production"
                ? "https://myapp.com"
                : "http://localhost:8787",
        }),
    ],
})
```

## Important Notes

1. **rpID must match**: The rpID must be the domain where your app is hosted. For localhost, use "localhost".

2. **Origin format**: The origin should include the protocol and port (if non-standard), but NO trailing slash.

3. **HTTPS in production**: Passkeys require HTTPS in production (localhost is exempted for development).

4. **Cookie prefix**: If using custom cookie names, ensure the `cookiePrefix` in your client matches your `webAuthnChallengeCookie` prefix.

## References

- [better-auth Passkey Documentation](https://www.better-auth.com/docs/plugins/passkey)
- [SimpleWebAuthn Documentation](https://simplewebauthn.dev/)
- [WebAuthn Guide](https://webauthn.guide/)

## Drizzle Schema for Passkey Table

If you're using Drizzle ORM, add this schema to your database schema file:

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema"; // your user table

export const passkey = sqliteTable("passkey", {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull().unique(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: integer("backed_up", { mode: "boolean" }).notNull(),
    transports: text("transports"),
    createdAt: integer("created_at", { mode: "timestamp" }),
    aaguid: text("aaguid"),
});
```

Or for PostgreSQL:

```typescript
import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth-schema"; // your user table

export const passkey = pgTable("passkey", {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull().unique(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    createdAt: timestamp("created_at"),
    aaguid: text("aaguid"),
});
```
