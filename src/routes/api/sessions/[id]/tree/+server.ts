import { json, error } from "@sveltejs/kit";
import { getDrizzle } from "$lib/auth";
import { agentSession, agentNode } from "$lib/schema";
import { eq, and } from "drizzle-orm";
import type { RequestHandler } from "./$types";

interface TreeNode {
  id: string;
  sessionId: string;
  parentId: string | null;
  name: string;
  agentType: string;
  model: string;
  status: string;
  config: string;
  containerId: string | null;
  sortOrder: number;
  tokens: number;
  createdAt: unknown;
  updatedAt: unknown;
  children: TreeNode[];
}

/**
 * GET /api/sessions/[id]/tree - Full tree with statuses
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw error(401, "Unauthorized");

  const db = getDrizzle();

  // Verify ownership
  const sessions = await db
    .select({ id: agentSession.id })
    .from(agentSession)
    .where(
      and(
        eq(agentSession.id, params.id),
        eq(agentSession.userId, locals.user.id),
      ),
    );
  if (sessions.length === 0) throw error(404, "Session not found");

  // Get all nodes
  const nodes = await db
    .select()
    .from(agentNode)
    .where(eq(agentNode.sessionId, params.id))
    .orderBy(agentNode.sortOrder);

  // Build tree
  const nodeMap = new Map<string, TreeNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, { ...node, children: [] } as TreeNode);
  }

  const roots: TreeNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return json({ tree: roots });
};
