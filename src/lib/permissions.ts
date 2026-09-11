import "server-only";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db/client";
import type { User, Workspace, WorkspaceRole } from "@/db/schema";

export type Verb = "view" | "edit" | "manage";

const RANK: Record<WorkspaceRole, number> = { viewer: 0, editor: 1, manager: 2 };
const NEED: Record<Verb, number> = { view: 0, edit: 1, manage: 2 };

export type Access = { workspace: Workspace; role: WorkspaceRole | "admin" };

/** Returns the workspace and the caller's effective role, or null when the caller may not even know it exists. */
export function accessFor(user: User, workspaceIdOrSlug: string, verb: Verb = "view"): Access | null {
  const ws =
    db.select().from(schema.workspaces).where(eq(schema.workspaces.id, workspaceIdOrSlug)).get() ??
    db.select().from(schema.workspaces).where(eq(schema.workspaces.slug, workspaceIdOrSlug)).get();
  if (!ws) return null;
  if (user.isAdmin) return { workspace: ws, role: "admin" };
  const m = db
    .select()
    .from(schema.memberships)
    .where(and(eq(schema.memberships.workspaceId, ws.id), eq(schema.memberships.userId, user.id)))
    .get();
  if (!m) return null;
  if (RANK[m.role] < NEED[verb]) return null;
  return { workspace: ws, role: m.role };
}

/** Non-members get a 404, never a 403: workspaces you are not in do not exist. */
export function requireAccess(user: User, workspaceIdOrSlug: string, verb: Verb = "view"): Access {
  const a = accessFor(user, workspaceIdOrSlug, verb);
  if (!a) notFound();
  return a;
}

/** For server actions: throw instead of redirecting. */
export function assertAccess(user: User, workspaceIdOrSlug: string, verb: Verb = "view"): Access {
  const a = accessFor(user, workspaceIdOrSlug, verb);
  if (!a) throw new Error("Not found");
  return a;
}

export const can = (a: Access, verb: Verb) => a.role === "admin" || RANK[a.role] >= NEED[verb];
