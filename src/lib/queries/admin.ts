import "server-only";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db, schema } from "@/db/client";
import { inviteExpired, type WorkspaceRole, type WorkspaceStatus } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { storage } from "@/lib/storage";

export type PersonMembership = { workspaceId: string; name: string; slug: string; accent: string; role: WorkspaceRole };

export type Person = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  deactivatedAt: number | null;
  lastSeenAt: number | null;
  createdAt: number;
  memberships: PersonMembership[];
};

export type InviteRow = {
  id: string;
  token: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
  workspaceRole: WorkspaceRole | null;
  workspace: { id: string; name: string; accent: string } | null;
  inviterName: string | null;
  /** Null when the link was made never to expire. */
  expiresAt: number | null;
  emailedAt: number | null;
  acceptedAt: number | null;
  revokedAt: number | null;
  createdAt: number;
  state: "pending" | "accepted" | "revoked" | "expired";
};

export type WorkspaceMemberRow = { userId: string; name: string; email: string; role: WorkspaceRole };

export type AdminWorkspace = {
  id: string;
  name: string;
  slug: string;
  accent: string;
  clientName: string | null;
  status: WorkspaceStatus;
  archivedAt: number | null;
  createdAt: number;
  openTasks: number;
  bytes: number;
  members: WorkspaceMemberRow[];
};

export type WorkspaceOption = { id: string; name: string; accent: string };
export type PersonOption = { id: string; name: string; email: string };

export type AuditRow = {
  id: number;
  action: string;
  subjectType: string | null;
  subjectId: string | null;
  meta: unknown;
  createdAt: number;
  actorName: string | null;
};

export type InstanceStats = { instanceName: string; people: number; workspaces: number; pendingInvites: number; bytes: number };

const nowS = () => Math.floor(Date.now() / 1000);

/** Public origin for links: the configured base URL, else the current request's host. */
export async function resolveBaseUrl(): Promise<string> {
  const configured = getSettings().baseUrl.trim().replace(/\/+$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function listPeople(): Person[] {
  const users = db.select().from(schema.users).orderBy(schema.users.name).all();
  const rows = db
    .select({
      userId: schema.memberships.userId,
      workspaceId: schema.workspaces.id,
      name: schema.workspaces.name,
      slug: schema.workspaces.slug,
      accent: schema.workspaces.accent,
      role: schema.memberships.role,
    })
    .from(schema.memberships)
    .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.memberships.workspaceId))
    .orderBy(schema.workspaces.name)
    .all();
  const byUser = new Map<string, PersonMembership[]>();
  for (const r of rows) {
    const list = byUser.get(r.userId) ?? [];
    list.push({ workspaceId: r.workspaceId, name: r.name, slug: r.slug, accent: r.accent, role: r.role });
    byUser.set(r.userId, list);
  }
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    isAdmin: u.isAdmin,
    deactivatedAt: u.deactivatedAt,
    lastSeenAt: u.lastSeenAt,
    createdAt: u.createdAt,
    memberships: byUser.get(u.id) ?? [],
  }));
}

export function listPersonOptions(): PersonOption[] {
  return db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.users)
    .where(isNull(schema.users.deactivatedAt))
    .orderBy(schema.users.name)
    .all();
}

export function listWorkspaceOptions(): WorkspaceOption[] {
  return db
    .select({ id: schema.workspaces.id, name: schema.workspaces.name, accent: schema.workspaces.accent })
    .from(schema.workspaces)
    .where(isNull(schema.workspaces.archivedAt))
    .orderBy(schema.workspaces.name)
    .all();
}

function inviteState(i: { acceptedAt: number | null; revokedAt: number | null; expiresAt: number | null }): InviteRow["state"] {
  if (i.acceptedAt) return "accepted";
  if (i.revokedAt) return "revoked";
  if (inviteExpired(i.expiresAt)) return "expired";
  return "pending";
}

export function listInvites(onlyPending = false): InviteRow[] {
  const rows = db
    .select({
      invite: schema.invites,
      inviterName: schema.users.name,
      wsId: schema.workspaces.id,
      wsName: schema.workspaces.name,
      wsAccent: schema.workspaces.accent,
    })
    .from(schema.invites)
    .leftJoin(schema.users, eq(schema.users.id, schema.invites.invitedBy))
    .leftJoin(schema.workspaces, eq(schema.workspaces.id, schema.invites.workspaceId))
    .orderBy(desc(schema.invites.createdAt))
    .all();
  const out = rows.map(({ invite, inviterName, wsId, wsName, wsAccent }) => ({
    id: invite.id,
    token: invite.token,
    email: invite.email,
    name: invite.name,
    isAdmin: invite.isAdmin,
    workspaceRole: invite.workspaceRole,
    workspace: wsId && wsName && wsAccent ? { id: wsId, name: wsName, accent: wsAccent } : null,
    inviterName,
    expiresAt: invite.expiresAt,
    emailedAt: invite.emailedAt,
    acceptedAt: invite.acceptedAt,
    revokedAt: invite.revokedAt,
    createdAt: invite.createdAt,
    state: inviteState(invite),
  }));
  return onlyPending ? out.filter((i) => i.state === "pending") : out;
}

export function countPendingInvites(): number {
  const row = db
    .select({ n: count() })
    .from(schema.invites)
    .where(and(isNull(schema.invites.acceptedAt), isNull(schema.invites.revokedAt), sql`${schema.invites.expiresAt} >= ${nowS()}`))
    .get();
  return row?.n ?? 0;
}

export async function listAdminWorkspaces(): Promise<AdminWorkspace[]> {
  const rows = db
    .select({
      ws: schema.workspaces,
      openTasks: sql<number>`(select count(*) from tasks t where t.workspace_id = ${schema.workspaces.id} and t.status != 'done')`,
    })
    .from(schema.workspaces)
    .orderBy(schema.workspaces.name)
    .all();
  const members = db
    .select({ workspaceId: schema.memberships.workspaceId, userId: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.memberships.role })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .orderBy(schema.users.name)
    .all();
  const byWs = new Map<string, WorkspaceMemberRow[]>();
  for (const m of members) {
    const list = byWs.get(m.workspaceId) ?? [];
    list.push({ userId: m.userId, name: m.name, email: m.email, role: m.role });
    byWs.set(m.workspaceId, list);
  }
  return Promise.all(
    rows.map(async ({ ws, openTasks }) => ({
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      accent: ws.accent,
      clientName: ws.clientName,
      status: ws.status,
      archivedAt: ws.archivedAt,
      createdAt: ws.createdAt,
      openTasks,
      bytes: await storage.usage(ws.id),
      members: byWs.get(ws.id) ?? [],
    })),
  );
}

export function auditPage(limit: number, offset: number): { rows: AuditRow[]; total: number } {
  const rows = db
    .select({
      id: schema.auditLog.id,
      action: schema.auditLog.action,
      subjectType: schema.auditLog.subjectType,
      subjectId: schema.auditLog.subjectId,
      meta: schema.auditLog.meta,
      createdAt: schema.auditLog.createdAt,
      actorName: schema.users.name,
    })
    .from(schema.auditLog)
    .leftJoin(schema.users, eq(schema.users.id, schema.auditLog.actorId))
    .orderBy(desc(schema.auditLog.id))
    .limit(limit)
    .offset(offset)
    .all();
  const total = db.select({ n: count() }).from(schema.auditLog).get()?.n ?? 0;
  return { rows, total };
}

export async function instanceStats(): Promise<InstanceStats> {
  const people = db.select({ n: count() }).from(schema.users).get()?.n ?? 0;
  const workspaces = db.select({ n: count() }).from(schema.workspaces).get()?.n ?? 0;
  return { instanceName: getSettings().instanceName, people, workspaces, pendingInvites: countPendingInvites(), bytes: await storage.usage() };
}
