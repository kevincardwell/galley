import "server-only";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db/client";

export type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: number | null;
  createdAt: number;
  workspace: { name: string; accent: string } | null;
};

export function listNotifications(userId: string, limit = 100): NotificationRow[] {
  return db
    .select({
      id: schema.notifications.id,
      kind: schema.notifications.kind,
      title: schema.notifications.title,
      body: schema.notifications.body,
      href: schema.notifications.href,
      readAt: schema.notifications.readAt,
      createdAt: schema.notifications.createdAt,
      wsName: schema.workspaces.name,
      wsAccent: schema.workspaces.accent,
    })
    .from(schema.notifications)
    .leftJoin(schema.workspaces, eq(schema.workspaces.id, schema.notifications.workspaceId))
    .where(eq(schema.notifications.userId, userId))
    .orderBy(desc(schema.notifications.createdAt), desc(schema.notifications.id))
    .limit(limit)
    .all()
    .map(({ wsName, wsAccent, ...n }) => ({ ...n, workspace: wsName && wsAccent ? { name: wsName, accent: wsAccent } : null }));
}

/** Unread inbox count for the sidebar bell. */
export function unreadCountFor(userId: string): number {
  return (
    db
      .select({ n: count() })
      .from(schema.notifications)
      .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)))
      .get()?.n ?? 0
  );
}
