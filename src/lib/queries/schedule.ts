import "server-only";
import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { User, Workspace } from "@/db/schema";
import { listWorkspacesFor } from "@/lib/queries/workspaces";
import { addDays, isoDate, startOfDay, toUnix } from "@/lib/dates";
import type { CalendarEntry, CalendarPerson, CalendarSupplier, ScheduleItemDetail } from "@/components/calendar/types";

type Scope = Pick<Workspace, "id" | "name" | "slug" | "accent">;

/**
 * Workspaces the caller may see. With a `workspaceId` the caller has already checked access
 * (pages use `requireAccess`), so that one workspace is used even when it is archived.
 */
function scopeFor(user: User, workspaceId?: string): Scope[] {
  if (workspaceId) {
    const ws = db
      .select({ id: schema.workspaces.id, name: schema.workspaces.name, slug: schema.workspaces.slug, accent: schema.workspaces.accent })
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, workspaceId))
      .get();
    return ws ? [ws] : [];
  }
  return listWorkspacesFor(user).map(({ ws }) => ({ id: ws.id, name: ws.name, slug: ws.slug, accent: ws.accent }));
}

export type ScheduleWindowArgs = {
  user: User;
  /** Local start of the window, inclusive. */
  from: Date;
  /** Local end of the window, exclusive. */
  to: Date;
  workspaceId?: string;
};

/**
 * Task due dates and schedule items between `from` and `to`, as one list in start order.
 * Tasks are all-day entries; items keep their own times.
 */
export function scheduleWindow({ user, from, to, workspaceId }: ScheduleWindowArgs): CalendarEntry[] {
  const scope = scopeFor(user, workspaceId);
  if (scope.length === 0) return [];
  const byId = new Map(scope.map((w) => [w.id, w]));
  const ids = scope.map((w) => w.id);
  const fromIso = isoDate(from);
  const toIso = isoDate(to);
  const fromUnix = toUnix(from);
  const toUnixExclusive = toUnix(to);

  const taskRows = db
    .select({
      id: schema.tasks.id,
      workspaceId: schema.tasks.workspaceId,
      title: schema.tasks.title,
      status: schema.tasks.status,
      dueOn: schema.tasks.dueOn,
      assigneeName: schema.users.name,
    })
    .from(schema.tasks)
    .leftJoin(schema.users, eq(schema.users.id, schema.tasks.assigneeId))
    .where(and(inArray(schema.tasks.workspaceId, ids), gte(schema.tasks.dueOn, fromIso), lt(schema.tasks.dueOn, toIso)))
    .orderBy(asc(schema.tasks.dueOn), asc(schema.tasks.position))
    .all();

  // An item counts as inside the window when any part of it is: it starts before the end and
  // finishes on or after the start, so a multi-day booking still shows on every day it covers.
  const itemRows = db
    .select({
      id: schema.scheduleItems.id,
      workspaceId: schema.scheduleItems.workspaceId,
      title: schema.scheduleItems.title,
      startsAt: schema.scheduleItems.startsAt,
      endsAt: schema.scheduleItems.endsAt,
      allDay: schema.scheduleItems.allDay,
      location: schema.scheduleItems.location,
      ownerName: schema.users.name,
    })
    .from(schema.scheduleItems)
    .leftJoin(schema.users, eq(schema.users.id, schema.scheduleItems.ownerId))
    .where(
      and(
        inArray(schema.scheduleItems.workspaceId, ids),
        lt(schema.scheduleItems.startsAt, toUnixExclusive),
        gte(sql`coalesce(${schema.scheduleItems.endsAt}, ${schema.scheduleItems.startsAt})`, fromUnix),
      ),
    )
    .orderBy(asc(schema.scheduleItems.startsAt))
    .all();

  const entries: CalendarEntry[] = [];

  for (const t of taskRows) {
    const ws = byId.get(t.workspaceId);
    if (!ws || !t.dueOn) continue;
    const day = new Date(`${t.dueOn}T00:00:00`);
    entries.push({
      kind: "task",
      id: t.id,
      title: t.title,
      workspaceId: ws.id,
      workspaceName: ws.name,
      workspaceSlug: ws.slug,
      accent: ws.accent,
      start: toUnix(startOfDay(day)),
      end: null,
      allDay: true,
      status: t.status,
      ownerName: t.assigneeName ?? undefined,
      href: `/w/${ws.slug}/tasks?task=${t.id}`,
    });
  }

  for (const i of itemRows) {
    const ws = byId.get(i.workspaceId);
    if (!ws) continue;
    entries.push({
      kind: "item",
      id: i.id,
      title: i.title,
      workspaceId: ws.id,
      workspaceName: ws.name,
      workspaceSlug: ws.slug,
      accent: ws.accent,
      start: i.startsAt,
      end: i.endsAt,
      allDay: i.allDay,
      location: i.location ?? undefined,
      ownerName: i.ownerName ?? undefined,
      href: `/w/${ws.slug}/calendar?date=${isoDate(new Date(i.startsAt * 1000))}&item=${i.id}`,
    });
  }

  return sortEntries(entries);
}

/** Start order, all-day first within a day, then alphabetical so the order never wobbles. */
export function sortEntries(entries: CalendarEntry[]): CalendarEntry[] {
  return entries.sort(
    (a, b) =>
      a.start - b.start ||
      Number(b.allDay) - Number(a.allDay) ||
      a.title.localeCompare(b.title) ||
      a.id.localeCompare(b.id),
  );
}

/** The next `days` days from today, for an agenda list. */
export function upcoming({ user, days = 14, workspaceId }: { user: User; days?: number; workspaceId?: string }): CalendarEntry[] {
  const from = startOfDay(new Date());
  return scheduleWindow({ user, from, to: addDays(from, Math.max(1, days)), workspaceId });
}

/** One schedule item, or null when it does not exist. The caller checks access to its workspace. */
export function itemDetail(id: string): ScheduleItemDetail | null {
  const row = db
    .select({ item: schema.scheduleItems, slug: schema.workspaces.slug })
    .from(schema.scheduleItems)
    .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.scheduleItems.workspaceId))
    .where(eq(schema.scheduleItems.id, id))
    .get();
  if (!row) return null;
  const { item } = row;
  return {
    id: item.id,
    workspaceId: item.workspaceId,
    workspaceSlug: row.slug,
    title: item.title,
    notes: item.notes,
    start: item.startsAt,
    end: item.endsAt,
    allDay: item.allDay,
    location: item.location,
    supplierId: item.supplierId,
    ownerId: item.ownerId,
  };
}

/** People and suppliers a schedule item in this workspace may be pinned to. */
export function scheduleOptions(workspaceId: string): { members: CalendarPerson[]; suppliers: CalendarSupplier[] } {
  const members = db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(eq(schema.memberships.workspaceId, workspaceId))
    .orderBy(asc(schema.users.name))
    .all();
  const suppliers = db
    .select({ id: schema.suppliers.id, name: schema.suppliers.name })
    .from(schema.workspaceSuppliers)
    .innerJoin(schema.suppliers, eq(schema.suppliers.id, schema.workspaceSuppliers.supplierId))
    .where(eq(schema.workspaceSuppliers.workspaceId, workspaceId))
    .orderBy(asc(schema.suppliers.name))
    .all();
  return { members, suppliers };
}

/** Workspaces this user may edit, so the calendar only offers drag where a move would be allowed. */
export function editableWorkspaceIds(user: User): string[] {
  if (user.isAdmin) return db.select({ id: schema.workspaces.id }).from(schema.workspaces).all().map((r) => r.id);
  return db
    .select({ id: schema.memberships.workspaceId })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.userId, user.id), inArray(schema.memberships.role, ["editor", "manager"])))
    .all()
    .map((r) => r.id);
}

/** Task due dates and schedule items for a whole workspace, for the subscribable feed. */
export function workspaceFeed(workspaceId: string) {
  const items = db
    .select()
    .from(schema.scheduleItems)
    .where(eq(schema.scheduleItems.workspaceId, workspaceId))
    .orderBy(asc(schema.scheduleItems.startsAt))
    .all();
  const tasks = db
    .select({
      id: schema.tasks.id,
      title: schema.tasks.title,
      dueOn: schema.tasks.dueOn,
      status: schema.tasks.status,
      createdAt: schema.tasks.createdAt,
      assigneeName: schema.users.name,
    })
    .from(schema.tasks)
    .leftJoin(schema.users, eq(schema.users.id, schema.tasks.assigneeId))
    .where(and(eq(schema.tasks.workspaceId, workspaceId), sql`${schema.tasks.dueOn} is not null`))
    .orderBy(asc(schema.tasks.dueOn))
    .all();
  return { items, tasks };
}
