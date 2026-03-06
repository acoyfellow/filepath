import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// ============================================
// Better-Auth Core Tables (required)
// ============================================

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .default(false)
    .notNull(),
  image: text("image"),
  banned: integer("banned", { mode: "boolean" }).default(false),
  role: text("role"),
  openrouterApiKey: text("openrouter_api_key"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// ============================================
// Better-Auth Plugin: Passkey
// ============================================

export const passkey = sqliteTable(
  "passkey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull().unique(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: integer("backed_up", { mode: "boolean" }).notNull(),
    transports: text("transports"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    aaguid: text("aaguid"),
  },
  (table) => [
    index("passkey_user_id_idx").on(table.userId),
    index("passkey_credential_id_unique").on(table.credentialID),
  ],
);

// ============================================
// Better-Auth Plugin: API Key
// ============================================

export const apikey = sqliteTable(
  "apikey",
  {
    id: text("id").primaryKey(),
    configId: text("config_id").notNull().default("default"),
    name: text("name"),
    start: text("start"),
    prefix: text("prefix"),
    key: text("key").notNull(),  // hashed key - better-auth expects 'key'
    referenceId: text("reference_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    // Better-auth required fields
    enabled: integer("enabled", { mode: "boolean" }).default(true),
    rateLimitEnabled: integer("rate_limit_enabled", { mode: "boolean" }).default(true),
    rateLimitTimeWindow: integer("rate_limit_time_window"),
    rateLimitMax: integer("rate_limit_max"),
    requestCount: integer("request_count").default(0),
    remaining: integer("remaining"),
    refillInterval: integer("refill_interval"),
    refillAmount: integer("refill_amount"),
    lastRefillAt: integer("last_refill_at", { mode: "timestamp_ms" }),
    lastRequest: integer("last_request", { mode: "timestamp_ms" }),
    permissions: text("permissions"),
    // Custom myfilepath fields
    totalUsageMinutes: integer("total_usage_minutes").default(0),
    encryptedSecrets: text("encrypted_secrets"),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("apikey_config_id_idx").on(table.configId),
    index("apikey_reference_id_idx").on(table.referenceId),
    index("apikey_key_idx").on(table.key),
  ],
);

// ============================================
// Relations
// ============================================

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  passkeys: many(passkey),
  apikeys: many(apikey),
  agentSessions: many(agentSession),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const passkeyRelations = relations(passkey, ({ one }) => ({
  user: one(user, {
    fields: [passkey.userId],
    references: [user.id],
  }),
}));

export const apikeyRelations = relations(apikey, ({ one }) => ({
  user: one(user, {
    fields: [apikey.referenceId],
    references: [user.id],
  }),
}));

// ============================================
// Agent Sessions (tree-native)
// ============================================

export const agentSession = sqliteTable(
  "agent_session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    gitRepoUrl: text("git_repo_url"),
    status: text("status").notNull().default("draft"),
    // 'draft' | 'running' | 'paused' | 'stopped' | 'error'
    rootNodeId: text("root_node_id"),
    apiKey: text("api_key"),
    // Per-session OpenRouter key override (encrypted). Null = use account key.
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    lastBilledAt: integer("last_billed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("agent_session_user_id_idx").on(table.userId),
    index("agent_session_status_idx").on(table.status),
  ],
);

export const agentHarness = sqliteTable(
  "agent_harness",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    adapter: text("adapter").notNull(),
    entryCommand: text("entry_command").notNull(),
    defaultModel: text("default_model").notNull(),
    icon: text("icon").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    config: text("config").notNull().default("{}"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("agent_harness_enabled_idx").on(table.enabled),
  ],
);

export const agentNode = sqliteTable(
  "agent_node",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => agentSession.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    // Self-referential. NULL = root node. FK enforced at app level.
    name: text("name").notNull(),
    agentType: text("agent_type")
      .notNull()
      .references(() => agentHarness.id),
    model: text("model").notNull(),
    status: text("status").notNull().default("idle"),
    // 'idle' | 'thinking' | 'running' | 'done' | 'error'
    config: text("config").notNull().default("{}"),
    // JSON: { systemPrompt?, envVars?, maxTokens? }
    containerId: text("container_id"),
    sortOrder: integer("sort_order").notNull().default(0),
    tokens: integer("tokens").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("agent_node_session_id_idx").on(table.sessionId),
    index("agent_node_parent_id_idx").on(table.parentId),
    index("agent_node_status_idx").on(table.status),
  ],
);

export const agentArtifact = sqliteTable(
  "agent_artifact",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => agentSession.id, { onDelete: "cascade" }),
    sourceNodeId: text("source_node_id")
      .notNull()
      .references(() => agentNode.id, { onDelete: "cascade" }),
    targetNodeId: text("target_node_id")
      .notNull()
      .references(() => agentNode.id, { onDelete: "cascade" }),
    sourcePath: text("source_path").notNull(),
    targetPath: text("target_path").notNull(),
    bucketKey: text("bucket_key").notNull(),
    status: text("status").notNull(),
    errorMessage: text("error_message"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("agent_artifact_session_id_idx").on(table.sessionId),
    index("agent_artifact_source_node_id_idx").on(table.sourceNodeId),
    index("agent_artifact_target_node_id_idx").on(table.targetNodeId),
    index("agent_artifact_status_idx").on(table.status),
  ],
);

// ============================================
// Agent Session Relations
// ============================================

export const agentSessionRelations = relations(agentSession, ({ one, many }) => ({
  user: one(user, {
    fields: [agentSession.userId],
    references: [user.id],
  }),
  nodes: many(agentNode),
  artifacts: many(agentArtifact),
}));

export const agentHarnessRelations = relations(agentHarness, ({ many }) => ({
  nodes: many(agentNode),
}));

export const agentNodeRelations = relations(agentNode, ({ one, many }) => ({
  session: one(agentSession, {
    fields: [agentNode.sessionId],
    references: [agentSession.id],
  }),
  harness: one(agentHarness, {
    fields: [agentNode.agentType],
    references: [agentHarness.id],
  }),
  parent: one(agentNode, {
    fields: [agentNode.parentId],
    references: [agentNode.id],
    relationName: "parentChild",
  }),
  children: many(agentNode, { relationName: "parentChild" }),
  outboundArtifacts: many(agentArtifact, { relationName: "artifactSource" }),
  inboundArtifacts: many(agentArtifact, { relationName: "artifactTarget" }),
}));

export const agentArtifactRelations = relations(agentArtifact, ({ one }) => ({
  session: one(agentSession, {
    fields: [agentArtifact.sessionId],
    references: [agentSession.id],
  }),
  sourceNode: one(agentNode, {
    fields: [agentArtifact.sourceNodeId],
    references: [agentNode.id],
    relationName: "artifactSource",
  }),
  targetNode: one(agentNode, {
    fields: [agentArtifact.targetNodeId],
    references: [agentNode.id],
    relationName: "artifactTarget",
  }),
}));
