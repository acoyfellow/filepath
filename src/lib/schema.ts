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
  workspaces: many(workspace),
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
// filepath v1 runtime tables
// ============================================

export const workspace = sqliteTable(
  "workspace",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    gitRepoUrl: text("git_repo_url"),
    memoryEnabled: integer("memory_enabled", { mode: "boolean" }).notNull().default(false),
    memoryScope: text("memory_scope"),
    status: text("status").notNull().default("draft"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("workspace_user_id_idx").on(table.userId),
    index("workspace_status_idx").on(table.status),
  ],
);

export const harness = sqliteTable(
  "harness",
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
    index("harness_enabled_idx").on(table.enabled),
  ],
);

export const agent = sqliteTable(
  "agent",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    harnessId: text("harness_id")
      .notNull()
      .references(() => harness.id),
    model: text("model").notNull(),
    status: text("status").notNull().default("idle"),
    config: text("config").notNull().default("{}"),
    allowedPaths: text("allowed_paths").notNull().default("[]"),
    forbiddenPaths: text("forbidden_paths").notNull().default("[]"),
    toolPermissions: text("tool_permissions").notNull().default("[]"),
    writableRoot: text("writable_root"),
    containerId: text("container_id"),
    activeProcessId: text("active_process_id"),
    cancelRequested: integer("cancel_requested", { mode: "boolean" }).notNull().default(false),
    closedAt: integer("closed_at", { mode: "timestamp_ms" }),
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
    index("agent_workspace_id_idx").on(table.workspaceId),
    index("agent_status_idx").on(table.status),
  ],
);

export const agentMessage = sqliteTable(
  "agent_message",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agent.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [index("agent_message_agent_id_idx").on(table.agentId)],
);

export const agentResult = sqliteTable("agent_result", {
  agentId: text("agent_id")
    .primaryKey()
    .notNull()
    .references(() => agent.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  summary: text("summary").notNull(),
  commands: text("commands").notNull(),
  filesTouched: text("files_touched").notNull(),
  violations: text("violations").notNull(),
  diffSummary: text("diff_summary"),
  commitJson: text("commit_json"),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  finishedAt: integer("finished_at", { mode: "timestamp_ms" }).notNull(),
});

export const agentTask = sqliteTable(
  "agent_task",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agent.id, { onDelete: "cascade" }),
    content: text("content").notNull().default(""),
    status: text("status").notNull(),
    resultStatus: text("result_status"),
    summary: text("summary").notNull().default(""),
    commands: text("commands").notNull().default("[]"),
    filesTouched: text("files_touched").notNull().default("[]"),
    violations: text("violations").notNull().default("[]"),
    diffSummary: text("diff_summary"),
    commitJson: text("commit_json"),
    traceId: text("trace_id"),
    proofRunId: text("proof_run_id"),
    proofIterationId: text("proof_iteration_id"),
    attempt: integer("attempt").notNull().default(0),
    requestId: text("request_id"),
    errorCode: text("error_code"),
    errorDetail: text("error_detail"),
    acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    heartbeatAt: integer("heartbeat_at", { mode: "timestamp_ms" }),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("agent_task_agent_id_idx").on(table.agentId),
    index("agent_task_finished_at_idx").on(table.finishedAt),
    index("agent_task_status_idx").on(table.status),
  ],
);

export const agentInterruption = sqliteTable(
  "agent_interruption",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    agentId: text("agent_id")
      .notNull()
      .references(() => agent.id, { onDelete: "cascade" }),
    runId: text("run_id"),
    traceId: text("trace_id"),
    proofRunId: text("proof_run_id"),
    proofIterationId: text("proof_iteration_id"),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    summary: text("summary").notNull(),
    requestedPermission: text("requested_permission"),
    payloadJson: text("payload_json").notNull().default("{}"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("agent_interruption_agent_id_idx").on(table.agentId),
    index("agent_interruption_workspace_id_idx").on(table.workspaceId),
    index("agent_interruption_status_idx").on(table.status),
  ],
);

export const workspaceRelations = relations(workspace, ({ one, many }) => ({
  user: one(user, {
    fields: [workspace.userId],
    references: [user.id],
  }),
  agents: many(agent),
  interruptions: many(agentInterruption),
}));

export const harnessRelations = relations(harness, ({ many }) => ({
  agents: many(agent),
}));

export const agentRelations = relations(agent, ({ one }) => ({
  workspace: one(workspace, {
    fields: [agent.workspaceId],
    references: [workspace.id],
  }),
  harness: one(harness, {
    fields: [agent.harnessId],
    references: [harness.id],
  }),
}));
