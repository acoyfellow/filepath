import { getDrizzle } from "$lib/auth";
import { getBuiltinHarnessRows } from "$lib/agents/harnesses";
import { agentHarness, agentNode, agentSession } from "$lib/schema";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { Data, Effect, Schema } from "effect";

type Db = ReturnType<typeof getDrizzle>;

export interface AppContext {
  db: Db;
  userId: string;
  role?: string | null;
  publishSessionEvent?: (sessionId: string, payload: Record<string, unknown>) => Promise<void>;
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

export const SessionCreateInputSchema = Schema.Struct({
  name: Schema.optional(Schema.String),
  gitRepoUrl: Schema.optional(Schema.String),
});
export type SessionCreateInput = Schema.Schema.Type<typeof SessionCreateInputSchema>;

export const SessionUpdateInputSchema = Schema.Struct({
  name: Schema.optional(Schema.String),
  status: Schema.optional(Schema.String),
  gitRepoUrl: Schema.optional(Schema.String),
});
export type SessionUpdateInput = Schema.Schema.Type<typeof SessionUpdateInputSchema>;

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
export type HarnessCreateInput = Schema.Schema.Type<typeof HarnessCreateInputSchema>;

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
export type HarnessUpdateInput = Schema.Schema.Type<typeof HarnessUpdateInputSchema>;

export const NodeSpawnInputSchema = Schema.Struct({
  name: Schema.String,
  harnessId: Schema.String,
  model: Schema.String,
  parentId: Schema.optional(Schema.String),
  config: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
});
export type NodeSpawnInput = Schema.Schema.Type<typeof NodeSpawnInputSchema>;

export const NodeUpdateInputSchema = Schema.Struct({
  name: Schema.optional(Schema.String),
  status: Schema.optional(Schema.String),
  config: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  containerId: Schema.optional(Schema.String),
  tokens: Schema.optional(Schema.Number),
});
export type NodeUpdateInput = Schema.Schema.Type<typeof NodeUpdateInputSchema>;

export const NodeMoveInputSchema = Schema.Struct({
  parentId: Schema.optional(Schema.NullOr(Schema.String)),
  sortOrder: Schema.Number,
});
export type NodeMoveInput = Schema.Schema.Type<typeof NodeMoveInputSchema>;

export function decodeInput<S extends Schema.Top>(
  schema: S,
  input: unknown,
): Effect.Effect<Schema.Schema.Type<S>, BadRequest> {
  return Schema.decodeUnknownEffect(schema)(input).pipe(
    Effect.mapError((error) => new BadRequest({ message: error.message })),
  ) as Effect.Effect<Schema.Schema.Type<S>, BadRequest>;
}

function fromPromise<A>(thunk: () => Promise<A>, message: string): Effect.Effect<A, Internal> {
  return Effect.tryPromise({
    try: thunk,
    catch: (cause) => new Internal({
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

function ensureSessionAccess(ctx: AppContext, sessionId: string) {
  return fromPromise(
    () =>
      ctx.db
        .select({ id: agentSession.id })
        .from(agentSession)
        .where(and(eq(agentSession.id, sessionId), eq(agentSession.userId, ctx.userId))),
    "Failed to verify session access",
  ).pipe(
    Effect.flatMap((rows) =>
      rows.length > 0
        ? Effect.succeed(rows[0])
        : Effect.fail(new NotFound({ message: "Session not found" })),
    ),
  );
}

function ensureBuiltinHarnesses(ctx: AppContext) {
  return fromPromise(
    () =>
      ctx.db
        .insert(agentHarness)
        .values(getBuiltinHarnessRows())
        .onConflictDoNothing(),
    "Failed to bootstrap builtin harnesses",
  ).pipe(Effect.asVoid);
}

function buildTree<T extends { id: string; parentId: string | null }>(nodes: T[]): Array<T & { children: Array<T & { children: unknown[] }> }> {
  const nodeMap = new Map<string, T & { children: Array<T & { children: unknown[] }> }>();
  for (const node of nodes) {
    nodeMap.set(node.id, { ...node, children: [] });
  }

  const roots: Array<T & { children: Array<T & { children: unknown[] }> }> = [];
  for (const node of nodeMap.values()) {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function collectDescendants(nodes: Array<{ id: string; parentId: string | null }>, parentId: string): Set<string> {
  const descendants = new Set<string>();
  const queue = [parentId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const node of nodes) {
      if (node.parentId === current && !descendants.has(node.id)) {
        descendants.add(node.id);
        queue.push(node.id);
      }
    }
  }

  return descendants;
}

export function listHarnesses(ctx: AppContext) {
  return ensureBuiltinHarnesses(ctx).pipe(
    Effect.flatMap(() =>
      fromPromise(
        () => ctx.db.select().from(agentHarness).orderBy(asc(agentHarness.name)),
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
        () => ctx.db.select({ id: agentHarness.id }).from(agentHarness).where(eq(agentHarness.id, input.id.trim())),
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
          ctx.db.insert(agentHarness).values({
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
        () => ctx.db.select({ id: agentHarness.id }).from(agentHarness).where(eq(agentHarness.id, id)),
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
            .update(agentHarness)
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
            .where(eq(agentHarness.id, id)),
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
        () => ctx.db.select({ id: agentHarness.id }).from(agentHarness).where(eq(agentHarness.id, id)),
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
        () => ctx.db.select({ id: agentNode.id }).from(agentNode).where(eq(agentNode.harnessId, id)),
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
        () => ctx.db.delete(agentHarness).where(eq(agentHarness.id, id)),
        "Failed to delete harness",
      ),
    ),
    Effect.as({ ok: true as const }),
  );
}

export function listSessions(ctx: AppContext) {
  return fromPromise(
    () =>
      ctx.db
        .select()
        .from(agentSession)
        .where(eq(agentSession.userId, ctx.userId))
        .orderBy(desc(agentSession.updatedAt)),
    "Failed to list sessions",
  ).pipe(
    Effect.flatMap((sessionsData) => {
      const sessionIds = sessionsData.map((session) => session.id);
      if (sessionIds.length === 0) {
        return Effect.succeed({ sessions: [] as Array<Record<string, unknown>> });
      }

      return fromPromise(
        () =>
          ctx.db
            .select({
              sessionId: agentNode.sessionId,
              count: count(),
            })
            .from(agentNode)
            .where(inArray(agentNode.sessionId, sessionIds))
            .groupBy(agentNode.sessionId),
        "Failed to count session agents",
      ).pipe(
        Effect.map((nodeCounts) => {
          const countMap = new Map(nodeCounts.map((row) => [row.sessionId, row.count]));
          return {
            sessions: sessionsData.map((session) => ({
              id: session.id,
              name: session.name,
              gitRepoUrl: session.gitRepoUrl,
              status: session.status,
              rootNodeId: session.rootNodeId,
              startedAt: session.startedAt,
              createdAt: session.createdAt?.getTime() ?? 0,
              updatedAt: session.updatedAt?.getTime() ?? 0,
              nodeCount: countMap.get(session.id) ?? 0,
            })),
          };
        }),
      );
    }),
  );
}

export function createSession(ctx: AppContext, input: SessionCreateInput) {
  const id = generateId();
  const name = input.name?.trim() || `Session ${id.slice(0, 6)}`;

  return fromPromise(
    () =>
      ctx.db.insert(agentSession).values({
        id,
        userId: ctx.userId,
        name,
        gitRepoUrl: input.gitRepoUrl?.trim() || null,
        status: "draft",
      }),
    "Failed to create session",
  ).pipe(
    Effect.as({ id, name }),
  );
}

export function getSession(ctx: AppContext, id: string) {
  return ensureSessionAccess(ctx, id).pipe(
    Effect.flatMap((_) =>
      fromPromise(
        () => ctx.db.select().from(agentSession).where(and(eq(agentSession.id, id), eq(agentSession.userId, ctx.userId))),
        "Failed to load session",
      ),
    ),
    Effect.flatMap((sessions) =>
      fromPromise(
        () => ctx.db.select().from(agentNode).where(eq(agentNode.sessionId, id)).orderBy(agentNode.sortOrder),
        "Failed to load session agents",
      ).pipe(
        Effect.map((nodes) => ({
          session: sessions[0],
          tree: buildTree(nodes),
        })),
      ),
    ),
  );
}

export function updateSession(ctx: AppContext, id: string, input: SessionUpdateInput) {
  return ensureSessionAccess(ctx, id).pipe(
    Effect.flatMap(() => {
      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.status !== undefined) updates.status = input.status;
      if (input.gitRepoUrl !== undefined) updates.gitRepoUrl = input.gitRepoUrl;
      if (Object.keys(updates).length === 0) {
        return Effect.succeed({ ok: true as const });
      }

      return fromPromise(
        () => ctx.db.update(agentSession).set(updates).where(eq(agentSession.id, id)),
        "Failed to update session",
      ).pipe(Effect.as({ ok: true as const }));
    }),
  );
}

export function deleteSession(ctx: AppContext, id: string) {
  return ensureSessionAccess(ctx, id).pipe(
    Effect.flatMap(() =>
      fromPromise(
        () => ctx.db.delete(agentSession).where(eq(agentSession.id, id)),
        "Failed to delete session",
      ),
    ),
    Effect.as({ ok: true as const }),
  );
}

export function listNodes(ctx: AppContext, sessionId: string) {
  return ensureSessionAccess(ctx, sessionId).pipe(
    Effect.flatMap(() =>
      fromPromise(
        () => ctx.db.select().from(agentNode).where(eq(agentNode.sessionId, sessionId)).orderBy(agentNode.sortOrder),
        "Failed to list session agents",
      ),
    ),
    Effect.map((nodes) => ({ nodes })),
  );
}

export function spawnNode(ctx: AppContext, sessionId: string, input: NodeSpawnInput) {
  return ensureBuiltinHarnesses(ctx).pipe(
    Effect.flatMap(() => ensureSessionAccess(ctx, sessionId)),
    Effect.flatMap(() =>
      fromPromise(
        () =>
          ctx.db
            .select({ id: agentHarness.id, enabled: agentHarness.enabled })
            .from(agentHarness)
            .where(eq(agentHarness.id, input.harnessId)),
        "Failed to load harness",
      ),
    ),
    Effect.flatMap((harnesses) => {
      if (harnesses.length === 0) {
        return Effect.fail(new BadRequest({ message: "Harness not found" }));
      }
      if (!harnesses[0].enabled) {
        return Effect.fail(new BadRequest({ message: "Harness is disabled" }));
      }
      return Effect.void;
    }),
    Effect.flatMap(() =>
      input.parentId
        ? fromPromise(
            () =>
              ctx.db
                .select({ id: agentNode.id })
                .from(agentNode)
                .where(and(eq(agentNode.id, input.parentId!), eq(agentNode.sessionId, sessionId))),
            "Failed to load parent agent",
          ).pipe(
            Effect.flatMap((parents) =>
              parents.length > 0
                ? Effect.void
                : Effect.fail(new BadRequest({ message: "Parent node not found" })),
            ),
          )
        : Effect.void,
    ),
    Effect.flatMap(() =>
      fromPromise(
        () =>
          (input.parentId
            ? ctx.db
                .select({ sortOrder: agentNode.sortOrder })
                .from(agentNode)
                .where(and(eq(agentNode.sessionId, sessionId), eq(agentNode.parentId, input.parentId)))
            : ctx.db
                .select({ sortOrder: agentNode.sortOrder })
                .from(agentNode)
                .where(and(eq(agentNode.sessionId, sessionId), sql`${agentNode.parentId} IS NULL`))),
        "Failed to load sibling agents",
      ),
    ),
    Effect.flatMap((siblings) => {
      const nextSort = siblings.length > 0 ? Math.max(...siblings.map((row) => row.sortOrder)) + 1 : 0;
      const nodeId = generateId();

      return fromPromise(
        () =>
          ctx.db.insert(agentNode).values({
            id: nodeId,
            sessionId,
            parentId: input.parentId || null,
            name: input.name,
            harnessId: input.harnessId,
            model: input.model,
            config: JSON.stringify(input.config ?? {}),
            sortOrder: nextSort,
          }),
        "Failed to create agent",
      ).pipe(
        Effect.flatMap(() =>
          !input.parentId
            ? fromPromise(
                () =>
                  ctx.db
                    .select({ rootNodeId: agentSession.rootNodeId })
                    .from(agentSession)
                    .where(eq(agentSession.id, sessionId)),
                "Failed to load session root agent",
              ).pipe(
                Effect.flatMap((rows) =>
                  !rows[0]?.rootNodeId
                    ? fromPromise(
                        () => ctx.db.update(agentSession).set({ rootNodeId: nodeId }).where(eq(agentSession.id, sessionId)),
                        "Failed to set session root agent",
                      )
                    : Effect.void,
                ),
              )
            : Effect.void,
        ),
        Effect.as({ id: nodeId, name: input.name }),
      );
    }),
  );
}

export function getNode(ctx: AppContext, sessionId: string, nodeId: string) {
  return ensureSessionAccess(ctx, sessionId).pipe(
    Effect.flatMap(() =>
      fromPromise(
        () =>
          ctx.db
            .select()
            .from(agentNode)
            .where(and(eq(agentNode.id, nodeId), eq(agentNode.sessionId, sessionId))),
        "Failed to load agent",
      ),
    ),
    Effect.flatMap((rows) =>
      rows.length > 0
        ? Effect.succeed({ node: rows[0] })
        : Effect.fail(new NotFound({ message: "Node not found" })),
    ),
  );
}

export function updateNode(ctx: AppContext, sessionId: string, nodeId: string, input: NodeUpdateInput) {
  return ensureSessionAccess(ctx, sessionId).pipe(
    Effect.flatMap(() => {
      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.status !== undefined) updates.status = input.status;
      if (input.config !== undefined) updates.config = JSON.stringify(input.config);
      if (input.containerId !== undefined) updates.containerId = input.containerId;
      if (input.tokens !== undefined) updates.tokens = input.tokens;

      if (Object.keys(updates).length === 0) {
        return Effect.succeed({ ok: true as const });
      }

      return fromPromise(
        () =>
          ctx.db
            .update(agentNode)
            .set(updates)
            .where(and(eq(agentNode.id, nodeId), eq(agentNode.sessionId, sessionId))),
        "Failed to update agent",
      ).pipe(Effect.as({ ok: true as const }));
    }),
  );
}

export function deleteNode(ctx: AppContext, sessionId: string, nodeId: string): Effect.Effect<{ ok: true; deleted: number }, AppError> {
  return ensureSessionAccess(ctx, sessionId).pipe(
    Effect.flatMap(() =>
      fromPromise(
        () =>
          ctx.db
            .select({ id: agentNode.id, parentId: agentNode.parentId })
            .from(agentNode)
            .where(eq(agentNode.sessionId, sessionId)),
        "Failed to load session agents",
      ),
    ),
    Effect.flatMap((nodes) => {
      if (!nodes.some((node) => node.id === nodeId)) {
        return Effect.fail<AppError>(new NotFound({ message: "Node not found" }));
      }

      const toDelete = new Set<string>([nodeId]);
      const queue = [nodeId];
      while (queue.length > 0) {
        const parentId = queue.shift()!;
        for (const node of nodes) {
          if (node.parentId === parentId && !toDelete.has(node.id)) {
            toDelete.add(node.id);
            queue.push(node.id);
          }
        }
      }

      return Effect.forEach([...toDelete], (id) =>
        fromPromise(
          () => ctx.db.delete(agentNode).where(and(eq(agentNode.id, id), eq(agentNode.sessionId, sessionId))),
          "Failed to delete agent",
        ),
      ).pipe(
        Effect.as({ ok: true as const, deleted: toDelete.size }),
      );
    }),
  );
}

export function moveNode(ctx: AppContext, sessionId: string, nodeId: string, input: NodeMoveInput): Effect.Effect<{ ok: true }, AppError> {
  return ensureSessionAccess(ctx, sessionId).pipe(
    Effect.flatMap(() => {
      if (!ctx.publishSessionEvent) {
        return Effect.fail<AppError>(new Unavailable({ message: "Session event bus unavailable" }));
      }

      return fromPromise(
        () =>
          ctx.db
            .select({
              id: agentNode.id,
              parentId: agentNode.parentId,
              sortOrder: agentNode.sortOrder,
            })
            .from(agentNode)
            .where(eq(agentNode.sessionId, sessionId)),
        "Failed to load agents for move",
      );
    }),
    Effect.flatMap((nodes) => {
      const movingNode = nodes.find((node) => node.id === nodeId);
      if (!movingNode) {
        return Effect.fail<AppError>(new NotFound({ message: "Node not found" }));
      }
      if (input.parentId === nodeId) {
        return Effect.fail<AppError>(new BadRequest({ message: "An agent cannot be moved under itself" }));
      }
      if (input.parentId && !nodes.some((node) => node.id === input.parentId)) {
        return Effect.fail<AppError>(new BadRequest({ message: "Destination agent not found" }));
      }

      const descendants = collectDescendants(nodes, nodeId);
      if (input.parentId && descendants.has(input.parentId)) {
        return Effect.fail<AppError>(new BadRequest({ message: "An agent cannot be moved under its descendant" }));
      }

      const clampIndex = (value: number, max: number) =>
        Math.max(0, Math.min(Number.isFinite(value) ? Math.floor(value) : 0, max));
      const sameParent = movingNode.parentId === (input.parentId ?? null);

      if (sameParent) {
        const siblingIds = nodes
          .filter((node) => node.parentId === movingNode.parentId)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((node) => node.id)
          .filter((id) => id !== nodeId);

        siblingIds.splice(clampIndex(input.sortOrder, siblingIds.length), 0, nodeId);

        return Effect.forEach(siblingIds, (id, index) =>
          fromPromise(
            () =>
              ctx.db
                .update(agentNode)
                .set({
                  parentId: movingNode.parentId,
                  sortOrder: index,
                })
                .where(and(eq(agentNode.id, id), eq(agentNode.sessionId, sessionId))),
            "Failed to reorder sibling agents",
          ),
        ).pipe(
          Effect.flatMap(() =>
            fromPromise(
              () =>
                ctx.publishSessionEvent!(sessionId, {
                  type: "tree_update",
                  action: "move",
                  nodeId,
                  parentId: movingNode.parentId,
                  sortOrder: clampIndex(input.sortOrder, siblingIds.length - 1),
                }),
              "Failed to publish move event",
            ),
          ),
          Effect.as({ ok: true as const }),
        );
      }

      const oldSiblingIds = nodes
        .filter((node) => node.parentId === movingNode.parentId && node.id !== nodeId)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((node) => node.id);

      const newSiblingIds = nodes
        .filter((node) => node.parentId === (input.parentId ?? null) && node.id !== nodeId)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((node) => node.id);

      newSiblingIds.splice(clampIndex(input.sortOrder, newSiblingIds.length), 0, nodeId);

      return Effect.forEach(oldSiblingIds, (id, index) =>
        fromPromise(
          () =>
            ctx.db
              .update(agentNode)
              .set({ sortOrder: index })
              .where(and(eq(agentNode.id, id), eq(agentNode.sessionId, sessionId))),
          "Failed to normalize old sibling order",
        ),
      ).pipe(
        Effect.flatMap(() =>
          Effect.forEach(newSiblingIds, (id, index) =>
            fromPromise(
              () =>
                ctx.db
                  .update(agentNode)
                  .set({
                    parentId: input.parentId ?? null,
                    sortOrder: index,
                  })
                  .where(and(eq(agentNode.id, id), eq(agentNode.sessionId, sessionId))),
              "Failed to write new sibling order",
            ),
          ),
        ),
        Effect.flatMap(() =>
          fromPromise(
            () =>
              ctx.publishSessionEvent!(sessionId, {
                type: "tree_update",
                action: "move",
                nodeId,
                parentId: input.parentId ?? null,
                sortOrder: clampIndex(input.sortOrder, newSiblingIds.length - 1),
              }),
            "Failed to publish move event",
          ),
        ),
        Effect.as({ ok: true as const }),
      );
    }),
  );
}

export function getSessionStatus(ctx: AppContext, sessionId: string) {
  return ensureSessionAccess(ctx, sessionId).pipe(
    Effect.flatMap(() =>
      fromPromise(
        () =>
          ctx.db
            .select({
              id: agentSession.id,
              status: agentSession.status,
              name: agentSession.name,
            })
            .from(agentSession)
            .where(and(eq(agentSession.id, sessionId), eq(agentSession.userId, ctx.userId))),
        "Failed to load session status",
      ),
    ),
    Effect.flatMap((sessions) =>
      fromPromise(
        () =>
          ctx.db
            .select({
              id: agentNode.id,
              name: agentNode.name,
              status: agentNode.status,
              parentId: agentNode.parentId,
              harnessId: agentNode.harnessId,
              tokens: agentNode.tokens,
              containerId: agentNode.containerId,
            })
            .from(agentNode)
            .where(eq(agentNode.sessionId, sessionId)),
        "Failed to load agent statuses",
      ).pipe(
        Effect.map((nodes) => ({
          session: sessions[0],
          nodes,
          summary: {
            total: nodes.length,
            done: nodes.filter((node) => node.status === "done").length,
            running: nodes.filter((node) => node.status === "running" || node.status === "thinking").length,
            exhausted: nodes.filter((node) => node.status === "exhausted").length,
            error: nodes.filter((node) => node.status === "error").length,
          },
        })),
      ),
    ),
  );
}
