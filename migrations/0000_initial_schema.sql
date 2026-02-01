-- Better-Auth Core Tables

CREATE TABLE "user" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
  "email" TEXT NOT NULL UNIQUE,
  "email_verified" INTEGER DEFAULT 0 NOT NULL,
  "image" TEXT,
  "banned" INTEGER DEFAULT 0,
  "role" TEXT,
  "credit_balance" INTEGER DEFAULT 0,
  "stripe_customer_id" TEXT,
  "created_at" INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  "updated_at" INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);

CREATE TABLE "session" (
  "id" TEXT PRIMARY KEY,
  "expires_at" INTEGER NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "created_at" INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  "updated_at" INTEGER NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE cascade
);

CREATE INDEX "session_userId_idx" ON "session" ("user_id");

CREATE TABLE "account" (
  "id" TEXT PRIMARY KEY,
  "account_id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "access_token" TEXT,
  "refresh_token" TEXT,
  "id_token" TEXT,
  "access_token_expires_at" INTEGER,
  "refresh_token_expires_at" INTEGER,
  "scope" TEXT,
  "password" TEXT,
  "created_at" INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  "updated_at" INTEGER NOT NULL
);

CREATE INDEX "account_userId_idx" ON "account" ("user_id");

CREATE TABLE "verification" (
  "id" TEXT PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expires_at" INTEGER NOT NULL,
  "created_at" INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  "updated_at" INTEGER NOT NULL
);

CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");

-- Better-Auth Plugin: Passkey

CREATE TABLE "passkey" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
  "public_key" TEXT NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "credential_id" TEXT NOT NULL UNIQUE,
  "counter" INTEGER NOT NULL,
  "device_type" TEXT NOT NULL,
  "backed_up" INTEGER NOT NULL,
  "transports" TEXT,
  "created_at" INTEGER NOT NULL
);

CREATE INDEX "passkey_user_id_idx" ON "passkey" ("user_id");
CREATE INDEX "passkey_credential_id_unique" ON "passkey" ("credential_id");

-- Better-Auth Plugin: API Key

CREATE TABLE "apikey" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
  "start" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "hashed_key" TEXT NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "expires_at" INTEGER,
  "last_used_at" INTEGER,
  "credit_balance" INTEGER DEFAULT 0,
  "total_usage_minutes" INTEGER DEFAULT 0,
  "created_at" INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  "updated_at" INTEGER NOT NULL
);

CREATE INDEX "apikey_user_id_idx" ON "apikey" ("user_id");
CREATE INDEX "apikey_prefix_idx" ON "apikey" ("prefix");
