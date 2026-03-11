import { getDrizzle } from "$lib/auth";
import {
  NODE_AUTHORITIES,
  normalizeNodeRuntimePolicy,
  validateNodeRuntimePolicy,
} from "$lib/runtime/authority";
import { getBuiltinHarnessRows } from "$lib/agents/harnesses";
import { agent, agentTask, harness, workspace } from "$lib/schema";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { Data, Effect, Schema } from "effect";

type Db = ReturnType<typeof getDrizzle>;

export interface AppContext {
  db: Db;
  userId: string;
  role?: string | null;
}

export class Unauthorized extends Data.TaggedError("Unauthorized")<{
  readonly message: string;
}> {}

export class Forbidden extends Data.TaggedError("Forbidden")<{
  readonly message: string;
}> {}

export class NotFound extends Data.TaggedError("NotFound")<{
  readonly message: string;
}> {}

export class Conflict extends Data.TaggedError("Conflict")<{
  readonly message: string;
}> {}

export class BadRequest extends Data.TaggedError("BadRequest")<{
  readonly message: string;
}> {}

export class Unavailable extends Data.TaggedError("Unavailable")<{
  readonly message: string;
}> {}

export class Internal extends Data.TaggedError("Internal")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export type AppError =
  | Unauthorized
  | Forbidden
  | NotFound
  | Conflict
  | BadRequest
  | Unavailable
  | Internal;

export const WorkspaceCreateInputSchema = Schema.Struct({
  name: Schema.optional(Schema.String),
  gitRepoUrl: Schema.optional(Schema.String),
});
export type WorkspaceCreateInput = Schema.Schema.Type<
  typeof WorkspaceCreateInputSchema
>;

export const WorkspaceUpdateInputSchema = Schema.Struct({
  name: Schema.optional(Schema.String),
  status: Schema.optional(Schema.String),
  gitRepoUrl: Schema.optional(Schema.String),
});
export type WorkspaceUpdateInput = Schema.Schema.Type<
  typeof WorkspaceUpdateInputSchema
>;

export const HarnessCreateInputSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.String,
  adapter: Schema.String,
  entryCommand: Schema.optional(Schema.String),
  defaultModel: Schema.String,
  icon: Schema.String,
  enabled: Schema.optional(Schema.Boolean),
  config: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
});
export type HarnessCreateInput = Schema.Schema.Type<
  typeof HarnessCreateInputSchema
>;

export const HarnessUpdateInputSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  adapter: Schema.String,
  entryCommand: Schema.optional(Schema.String),
  defaultModel: Schema.String,
  icon: Schema.String,
  enabled: Schema.optional(Schema.Boolean),
  config: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
});
export type HarnessUpdateInput = Schema.Schema.Type<
  typeof HarnessUpdateInputSchema
>;

export const AgentCreateInputSchema = Schema.Struct({
  name: Schema.String,
  harnessId: Schema.String,
  model: Schema.String,
  allowedPaths: Schema.Array(Schema.String),
  forbiddenPaths: Schema.Array(Schema.String),
  toolPermissions: Schema.Array(Schema.String),
  writableRoot: Schema.NullOr(Schema.String),
  config: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
});
export type AgentCreateInput = Schema.Schema.Type<
  typeof AgentCreateInputSchema
>;

export const AgentUpdateInputSchema = Schema.Struct({
  name: Schema.optional(Schema.String),
  model: Schema.optional(Schema.String),
  status: Schema.optional(Schema.String),
  config: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  allowedPaths: Schema.optional(Schema.Array(Schema.String)),
  forbiddenPaths: Schema.optional(Schema.Array(Schema.String)),
  toolPermissions: Schema.optional(Schema.Array(Schema.String)),
  writableRoot: Schema.optional(Schema.NullOr(Schema.String)),
  containerId: Schema.optional(Schema.String),
  tokens: Schema.optional(Schema.Number),
});
export type AgentUpdateInput = Schema.Schema.Type<
  typeof AgentUpdateInputSchema
>;

export const AgentTaskInputSchema = Schema.Struct({
  content: Schema.String,
});
export type AgentTaskInput = Schema.Schema.Type<typeof AgentTaskInputSchema>;

function decodePolicy(input: {
  allowedPaths?: readonly string[];
  forbiddenPaths?: readonly string[];
  toolPermissions?: readonly string[];
  writableRoot?: string | null;
}): Effect.Effect<
  ReturnType<typeof normalizeNodeRuntimePolicy>,
  BadRequest
> {
  const policy = normalizeNodeRuntimePolicy("agent", input);
  const policyError = validateNodeRuntimePolicy("agent", policy);
  return policyError
    ? Effect.fail(new BadRequest({ message: policyError }))
    : Effect.succeed(policy);
}

export function decodeInput<S extends Schema.Top>(
  schema: S,
  input: unknown,
): Effect.Effect<Schema.Schema.Type<S>, BadRequest> {
  return Schema.decodeUnknownEffect(schema)(input).pipe(
    Effect.mapError((error) => new BadRequest({ message: error.message })),
  ) as Effect.Effect<Schema.Schema.Type<S>, BadRequest>;
}

function fromPromise<A>(
  thunk: () => Promise<A>,
  message: string,
): Effect.Effect<A, Internal> {
  return Effect.tryPromise({
    try: thunk,
    catch: (cause) =>
      new Internal({
        message,
        cause,
      }),
  });
}

function generateId(length = 16): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let index = 0; index < length; index += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function requireAdmin(ctx: AppContext): Effect.Effect<void, Forbidden> {
  return ctx.role === "admin"
    ? Effect.void
    : Effect.fail(new Forbidden({ message: "Admin only" }));
}

function ensureWorkspaceAccess(ctx: AppContext, workspaceId: string) {
  return fromPromise(
    () =>
      ctx.db
        .select({ id: workspace.id })
        .from(workspace)
        .where(and(eq(workspace.id, workspaceId), eq(workspace.userId, ctx.userId))),
    "Failed to verify workspace access",
  ).pipe(
    Effect.flatMap((rows) =>
      rows.length > 0
        ? Effect.succeed(rows[0])
        : Effect.fail(new NotFound({ message: "Workspace not found" })),
    ),
  );
}

function ensureBuiltinHarnesses(ctx: AppContext) {
  return fromPromise(
    () =>
      ctx.db.insert(harness).values(getBuiltinHarnessRows()).onConflictDoNothing(),
    "Failed to bootstrap builtin harnesses",
  ).pipe(Effect.asVoid);
}

export function listHarnesses(ctx: AppContext) {
  return ensureBuiltinHarnesses(ctx).pipe(
    Effect.flatMap(() =>
      fromPromise(
        () => ctx.db.select().from(harness).orderBy(asc(harness.name)),
        "Failed to list harnesses",
      ),
    ),
    Effect.map((rows) => ({
      harnesses: rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        adapter: row.adapter,
        entryCommand: row.entryCommand,
        defaultModel: row.defaultModel,
        icon: row.icon,
        enabled: row.enabled,
        config: JSON.parse(row.config) as Record<string, unknown>,
      })),
    })),
  );
}

export function createHarness(ctx: AppContext, input: HarnessCreateInput) {
  return ensureBuiltinHarnesses(ctx).pipe(
    Effect.flatMap(() => requireAdmin(ctx)),
    Effect.flatMap(() =>
      fromPromise(
        () => ctx.db.select({ id: harness.id }).from(harness).where(eq(harness.id, input.id.trim())),
        "Failed to check harness uniqueness",
      ),
    ),
    Effect.flatMap((rows) =>
      rows.length === 0
        ? Effect.void
        : Effect.fail(new Conflict({ message: "Harness already exists" })),
    ),
    Effect.flatMap(() =>
      fromPromise(
        () =>
          ctx.db.insert(harness).values({
            id: input.id.trim(),
            name: input.name.trim(),
            description: input.description.trim(),
            adapter: input.adapter.trim(),
            entryCommand: input.entryCommand?.trim() ?? "",
            defaultModel: input.defaultModel.trim(),
            icon: input.icon.trim(),
            enabled: input.enabled ?? true,
            config: JSON.stringify(input.config ?? {}),
          }),
        "Failed to create harness",
      ),
    ),
    Effect.as({ ok: true as const }),
  );
}

export function updateHarness(ctx: AppContext, id: string, input: HarnessUpdateInput) {
  return ensureBuiltinHarnesses(ctx).pipe(
    Effect.flatMap(() => requireAdmin(ctx)),
    Effect.flatMap(() =>
      fromPromise(
        () => ctx.db.select({ id: harness.id }).from(harness).where(eq(harness.id, id)),
        "Failed to load harness",
      ),
    ),
    Effect.flatMap((rows) =>
      rows.length > 0
        ? Effect.void
        : Effect.fail(new NotFound({ message: "Harness not found" })),
    ),
    Effect.flatMap(() =>
      fromPromise(
        () =>
          ctx.db
            .update(harness)
            .set({
              name: input.name.trim(),
              description: input.description.trim(),
              adapter: input.adapter.trim(),
              entryCommand: input.entryCommand?.trim() ?? "",
              defaultModel: input.defaultModel.trim(),
              icon: input.icon.trim(),
              enabled: input.enabled ?? true,
              config: JSON.stringify(input.config ?? {}),
            })
            .where(eq(harness.id, id)),
        "Failed to update harness",
      ),
    ),
    Effect.as({ ok: true as const }),
  );
}

export function deleteHarness(ctx: AppContext, id: string) {
  return ensureBuiltinHarnesses(ctx).pipe(
    Effect.flatMap(() => requireAdmin(ctx)),
    Effect.flatMap(() =>
      fromPromise(
        () => ctx.db.select({ id: harness.id }).from(harness).where(eq(harness.id, id)),
        "Failed to load harness",
      ),
    ),
    Effect.flatMap((rows) =>
      rows.length > 0
        ? Effect.void
        : Effect.fail(new NotFound({ message: "Harness not found" })),
    ),
    Effect.flatMap(() =>
      fromPromise(
        () => ctx.db.select({ id: agent.id }).from(agent).where(eq(agent.harnessId, id)),
        "Failed to load linked agents",
      ),
    ),
    Effect.flatMap((rows) =>
      rows.length === 0
        ? Effect.void
        : Effect.fail(new Conflict({ message: "Harness is in use by existing agents" })),
    ),
    Effect.flatMap(() =>
      fromPromise(
        () => ctx.db.delete(harness).where(eq(harness.id, id)),
        "Failed to delete harness",
      ),
    ),
    Effect.as({ ok: true as const }),
  );
}

export function listWorkspaces(ctx: AppContext) {
  return fromPromise(
    () =>
      ctx.db
        .select()
        .from(workspace)
        .where(eq(workspace.userId, ctx.userId))
        .orderBy(desc(workspace.updatedAt)),
    "Failed to list workspaces",
  ).pipe(
    Effect.flatMap((workspaceRows) => {
      const workspaceIds = workspaceRows.map((entry) => entry.id);
      if (workspaceIds.length === 0) {
        return Effect.succeed({ workspaces: [] as Array<Record<string, unknown>> });
      }

      return fromPromise(
        () =>
          ctx.db
            .select({
              workspaceId: agent.workspaceId,
              count: count(agent.id),
            })
            .from(agent)
            .where(inArray(agent.workspaceId, workspaceIds))
            .groupBy(agent.workspaceId),
        "Failed to count workspace agents",
      ).pipe(
        Effect.map((agentCounts) => {
          const countMap = new Map(
            agentCounts.map((entry) => [entry.workspaceId, entry.count]),
          );

          return {
            workspaces: workspaceRows.map((entry) => ({
              id: entry.id,
              name: entry.name,
              gitRepoUrl: entry.gitRepoUrl,
              status: entry.status,
              startedAt: entry.startedAt?.getTime() ?? null,
              createdAt: entry.createdAt?.getTime() ?? 0,
              updatedAt: entry.updatedAt?.getTime() ?? 0,
              agentCount: countMap.get(entry.id) ?? 0,
            })),
          };
        }),
      );
    }),
  );
}

export function createWorkspace(ctx: AppContext, input: WorkspaceCreateInput) {
  const id = generateId();
  const name = input.name?.trim() || `Workspace ${id.slice(0, 6)}`;

  return fromPromise(
    () =>
      ctx.db.insert(workspace).values({
        id,
        userId: ctx.userId,
        name,
        gitRepoUrl: input.gitRepoUrl?.trim() || null,
        status: "draft",
      }),
    "Failed to create workspace",
  ).pipe(Effect.as({ id, name }));
}

export function getWorkspace(ctx: AppContext, id: string) {
  return ensureWorkspaceAccess(ctx, id).pipe(
    Effect.flatMap(() =>
      fromPromise(
        () =>
          ctx.db
            .select()
            .from(workspace)
            .where(and(eq(workspace.id, id), eq(workspace.userId, ctx.userId))),
        "Failed to load workspace",
      ),
    ),
    Effect.flatMap((workspaceRows) =>
      fromPromise(
        () =>
          ctx.db
            .select()
            .from(agent)
            .where(eq(agent.workspaceId, id))
            .orderBy(desc(agent.updatedAt), desc(agent.createdAt)),
        "Failed to load workspace agents",
      ).pipe(
        Effect.map((agents) => ({
          workspace: workspaceRows[0],
          agents,
        })),
      ),
    ),
  );
}

export function updateWorkspace(
  ctx: AppContext,
  id: string,
  input: WorkspaceUpdateInput,
) {
  return ensureWorkspaceAccess(ctx, id).pipe(
    Effect.flatMap(() => {
      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.status !== undefined) updates.status = input.status;
      if (input.gitRepoUrl !== undefined) updates.gitRepoUrl = input.gitRepoUrl;
      if (Object.keys(updates).length === 0) {
        return Effect.succeed({ ok: true as const });
      }

      return fromPromise(
        () => ctx.db.update(workspace).set(updates).where(eq(workspace.id, id)),
        "Failed to update workspace",
      ).pipe(Effect.as({ ok: true as const }));
    }),
  );
}

export function deleteWorkspace(ctx: AppContext, id: string) {
  return ensureWorkspaceAccess(ctx, id).pipe(
    Effect.flatMap(() =>
      fromPromise(
        () => ctx.db.delete(workspace).where(eq(workspace.id, id)),
        "Failed to delete workspace",
      ),
    ),
    Effect.as({ ok: true as const }),
  );
}

export function listAgents(ctx: AppContext, workspaceId: string) {
  return ensureWorkspaceAccess(ctx, workspaceId).pipe(
    Effect.flatMap(() =>
      fromPromise(
        () =>
          ctx.db
            .select()
            .from(agent)
            .where(eq(agent.workspaceId, workspaceId))
            .orderBy(desc(agent.updatedAt), desc(agent.createdAt)),
        "Failed to list workspace agents",
      ),
    ),
    Effect.map((agents) => ({ agents })),
  );
}

export function createAgent(
  ctx: AppContext,
  workspaceId: string,
  input: AgentCreateInput,
) {
  return ensureBuiltinHarnesses(ctx).pipe(
    Effect.flatMap(() => ensureWorkspaceAccess(ctx, workspaceId)),
    Effect.flatMap(() =>
      fromPromise(
        () =>
          ctx.db
            .select({ id: harness.id, enabled: harness.enabled })
            .from(harness)
            .where(eq(harness.id, input.harnessId)),
        "Failed to load harness",
      ),
    ),
    Effect.flatMap((harnessRows) => {
      if (harnessRows.length === 0) {
        return Effect.fail(new BadRequest({ message: "Harness not found" }));
      }
      if (!harnessRows[0].enabled) {
        return Effect.fail(new BadRequest({ message: "Harness is disabled" }));
      }
      return Effect.void;
    }),
    Effect.flatMap(() =>
      decodePolicy({
        allowedPaths: input.allowedPaths,
        forbiddenPaths: input.forbiddenPaths,
        toolPermissions: input.toolPermissions,
        writableRoot: input.writableRoot,
      }),
    ),
    Effect.flatMap((policy): Effect.Effect<{ id: string; name: string }, AppError> => {
      const agentId = generateId();
      const trimmedName = input.name.trim();
      if (!trimmedName) {
        return Effect.fail(new BadRequest({ message: "Agent name is required" }));
      }
      if (!input.model.trim()) {
        return Effect.fail(new BadRequest({ message: "Choose a model before creating an agent" }));
      }

      return fromPromise(
        () =>
          ctx.db.insert(agent).values({
            id: agentId,
            workspaceId,
            name: trimmedName,
            harnessId: input.harnessId,
            model: input.model.trim(),
            config: JSON.stringify(input.config ?? {}),
            allowedPaths: JSON.stringify(policy.allowedPaths),
            forbiddenPaths: JSON.stringify(policy.forbiddenPaths),
            toolPermissions: JSON.stringify(policy.toolPermissions),
            writableRoot: policy.writableRoot,
          }),
        "Failed to create agent",
      ).pipe(Effect.as({ id: agentId, name: trimmedName }));
    }),
  );
}

export function getAgent(ctx: AppContext, workspaceId: string, agentId: string) {
  return ensureWorkspaceAccess(ctx, workspaceId).pipe(
    Effect.flatMap(() =>
      fromPromise(
        () =>
          ctx.db
            .select()
            .from(agent)
            .where(and(eq(agent.id, agentId), eq(agent.workspaceId, workspaceId))),
        "Failed to load agent",
      ),
    ),
    Effect.flatMap((rows) =>
      rows.length > 0
        ? Effect.succeed({ agent: rows[0] })
        : Effect.fail(new NotFound({ message: "Agent not found" })),
    ),
  );
}

export function updateAgent(
  ctx: AppContext,
  workspaceId: string,
  agentId: string,
  input: AgentUpdateInput,
) {
  return ensureWorkspaceAccess(ctx, workspaceId).pipe(
    Effect.flatMap((): Effect.Effect<{ ok: true }, AppError> => {
      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.model !== undefined) updates.model = input.model;
      if (input.status !== undefined) updates.status = input.status;
      if (input.config !== undefined) updates.config = JSON.stringify(input.config);
      if (input.containerId !== undefined) updates.containerId = input.containerId;
      if (input.tokens !== undefined) updates.tokens = input.tokens;

      if (
        input.allowedPaths !== undefined ||
        input.forbiddenPaths !== undefined ||
        input.toolPermissions !== undefined ||
        input.writableRoot !== undefined
      ) {
        return decodePolicy({
          allowedPaths: input.allowedPaths,
          forbiddenPaths: input.forbiddenPaths,
          toolPermissions: input.toolPermissions,
          writableRoot: input.writableRoot,
        }).pipe(
          Effect.flatMap((policy) => {
            updates.allowedPaths = JSON.stringify(policy.allowedPaths);
            updates.forbiddenPaths = JSON.stringify(policy.forbiddenPaths);
            updates.toolPermissions = JSON.stringify(policy.toolPermissions);
            updates.writableRoot = policy.writableRoot;

            return fromPromise(
              () =>
                ctx.db
                  .update(agent)
                  .set(updates)
                  .where(and(eq(agent.id, agentId), eq(agent.workspaceId, workspaceId))),
              "Failed to update agent",
            ).pipe(Effect.as({ ok: true as const }));
          }),
        );
      }

      if (Object.keys(updates).length === 0) {
        return Effect.succeed({ ok: true as const });
      }

      return fromPromise(
        () =>
          ctx.db
            .update(agent)
            .set(updates)
            .where(and(eq(agent.id, agentId), eq(agent.workspaceId, workspaceId))),
        "Failed to update agent",
      ).pipe(Effect.as({ ok: true as const }));
    }),
  );
}

export function deleteAgent(ctx: AppContext, workspaceId: string, agentId: string) {
  return ensureWorkspaceAccess(ctx, workspaceId).pipe(
    Effect.flatMap(() =>
      fromPromise(
        () =>
          ctx.db
            .delete(agent)
            .where(and(eq(agent.id, agentId), eq(agent.workspaceId, workspaceId))),
        "Failed to delete agent",
      ),
    ),
    Effect.as({ ok: true as const }),
  );
}

export function listAgentResults(
  ctx: AppContext,
  workspaceId: string,
  agentId: string,
  limit = 20,
) {
  return ensureWorkspaceAccess(ctx, workspaceId).pipe(
    Effect.flatMap(() =>
      fromPromise(
        () =>
          ctx.db
            .select({
              id: agentTask.id,
              content: agentTask.content,
              status: agentTask.status,
              summary: agentTask.summary,
              commands: agentTask.commands,
              filesTouched: agentTask.filesTouched,
              violations: agentTask.violations,
              diffSummary: agentTask.diffSummary,
              commitJson: agentTask.commitJson,
              startedAt: agentTask.startedAt,
              finishedAt: agentTask.finishedAt,
            })
            .from(agentTask)
            .innerJoin(agent, eq(agentTask.agentId, agent.id))
            .where(and(eq(agentTask.agentId, agentId), eq(agent.workspaceId, workspaceId)))
            .orderBy(desc(agentTask.finishedAt))
            .limit(limit),
        "Failed to list agent results",
      ),
    ),
    Effect.map((rows) => ({
      results: rows.map((row) => ({
        id: row.id,
        content: row.content,
        status: row.status,
        summary: row.summary,
        commands: JSON.parse(row.commands) as Array<{ command: string; exitCode: number | null }>,
        filesTouched: JSON.parse(row.filesTouched) as string[],
        violations: JSON.parse(row.violations) as string[],
        diffSummary: row.diffSummary,
        commit: row.commitJson ? (JSON.parse(row.commitJson) as { sha: string; message: string }) : null,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
      })),
    })),
  );
}
