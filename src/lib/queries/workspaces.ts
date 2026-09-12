import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { User } from "@/db/schema";

/**
 * Workspaces the user is allowed to see, with a few counts for the grid.
 *
 * The correlated subqueries name `workspaces.id` literally: interpolating the Drizzle column
 * (`${schema.workspaces.id}`) renders a bare `"id"`, which SQLite binds to the subquery's own
 * table, so every count silently returned 0.
 */
export function listWorkspacesFor(user: User, includeArchived = false) {
  const base = db
    .select({
      ws: schema.workspaces,
      openTasks: sql<number>`(select count(*) from tasks t where t.workspace_id = workspaces.id and t.status != 'done')`,
      approvedSections: sql<number>`(select count(*) from sections s where s.workspace_id = workspaces.id and s.status = 'approved')`,
      totalSections: sql<number>`(select count(*) from sections s where s.workspace_id = workspaces.id)`,
      assetCount: sql<number>`(select count(*) from assets a where a.workspace_id = workspaces.id)`,
      lastActivity: sql<number | null>`(select max(created_at) from activity ac where ac.workspace_id = workspaces.id)`,
    })
    .from(schema.workspaces);

  const archived = includeArchived ? undefined : isNull(schema.workspaces.archivedAt);
  if (user.isAdmin) return base.where(archived).orderBy(desc(schema.workspaces.createdAt)).all();

  const ids = db.select({ id: schema.memberships.workspaceId }).from(schema.memberships).where(eq(schema.memberships.userId, user.id));
  return base.where(and(inArray(schema.workspaces.id, ids), archived)).orderBy(desc(schema.workspaces.createdAt)).all();
}

export function listMembers(workspaceId: string) {
  return db
    .select({ user: schema.users, role: schema.memberships.role, createdAt: schema.memberships.createdAt })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(eq(schema.memberships.workspaceId, workspaceId))
    .orderBy(schema.users.name)
    .all();
}

export function recentActivity(workspaceId: string, limit = 20) {
  return db
    .select({ a: schema.activity, actorName: schema.users.name })
    .from(schema.activity)
    .leftJoin(schema.users, eq(schema.users.id, schema.activity.actorId))
    .where(eq(schema.activity.workspaceId, workspaceId))
    .orderBy(desc(schema.activity.createdAt))
    .limit(limit)
    .all();
}
