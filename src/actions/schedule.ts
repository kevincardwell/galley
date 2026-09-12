"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import type { ScheduleItem, User, Workspace } from "@/db/schema";
import { requireUser } from "@/lib/auth/current";
import { assertAccess } from "@/lib/permissions";
import { newId } from "@/lib/ids";
import { logActivity } from "@/lib/activity";
import { ISO_DATE, addDays, daysBetween, fromUnix, isoDate, parseIsoDate, parseLocalDateTime, startOfDay, toInputValue, toUnix } from "@/lib/dates";
import type { MoveEntryInput, ScheduleItemInput, ScheduleItemPatch } from "@/components/calendar/types";

const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/;

const titleSchema = z.string().trim().min(1, "Give it a title").max(200, "Keep the title under 200 characters");
const timeSchema = z.string().regex(LOCAL_TIME, "Use a real date and time");

const inputSchema = z.object({
  title: titleSchema,
  start: timeSchema,
  end: timeSchema.nullable().optional(),
  allDay: z.boolean().optional(),
  location: z.string().trim().max(200, "Keep the location under 200 characters").nullable().optional(),
  notes: z.string().trim().max(4000, "Keep the notes under 4000 characters").nullable().optional(),
  supplierId: z.string().nullable().optional(),
  ownerId: z.string().nullable().optional(),
});

const patchSchema = inputSchema.partial();

const moveSchema = z.object({
  kind: z.enum(["task", "item"]),
  id: z.string().min(1),
  toIsoDate: z.string().regex(ISO_DATE, "Use a real date"),
  keepTime: z.boolean().optional(),
});

function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Check the form";
}

/** Every view that shows this project's dates. */
function refresh(workspace: Workspace) {
  revalidatePath(`/w/${workspace.slug}`, "layout");
  revalidatePath("/calendar");
  revalidatePath("/me/tasks");
}

type ItemContext = { user: User; item: ScheduleItem; workspace: Workspace };

/** Load an item and check the caller may edit its workspace. Unknown or foreign items read as "Not found". */
async function editableItem(id: string): Promise<ItemContext> {
  const user = await requireUser();
  const item = db.select().from(schema.scheduleItems).where(eq(schema.scheduleItems.id, id)).get();
  if (!item) throw new Error("Not found");
  const { workspace } = assertAccess(user, item.workspaceId, "edit");
  return { user, item, workspace };
}

function assertOwner(workspaceId: string, userId: string) {
  const member = db
    .select({ userId: schema.memberships.userId })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.workspaceId, workspaceId), eq(schema.memberships.userId, userId)))
    .get();
  if (member) return;
  const admin = db.select({ isAdmin: schema.users.isAdmin }).from(schema.users).where(eq(schema.users.id, userId)).get();
  if (!admin?.isAdmin) throw new Error("That person is not on this project");
}

function assertSupplier(workspaceId: string, supplierId: string) {
  const link = db
    .select({ id: schema.workspaceSuppliers.id })
    .from(schema.workspaceSuppliers)
    .where(and(eq(schema.workspaceSuppliers.workspaceId, workspaceId), eq(schema.workspaceSuppliers.supplierId, supplierId)))
    .get();
  if (!link) throw new Error("That supplier is not on this project");
}

/**
 * Local datetime strings from the client to unix seconds on the server. An all-day entry is
 * stored as local midnight on its first day, and ends at local midnight on its last one.
 */
function instants(start: string, end: string | null | undefined, allDay: boolean): { startsAt: number; endsAt: number | null } {
  const from = parseLocalDateTime(start);
  if (!from) throw new Error("Use a real start date");
  const startsAt = toUnix(allDay ? startOfDay(from) : from);
  let endsAt: number | null = null;
  if (end) {
    const to = parseLocalDateTime(end);
    if (!to) throw new Error("Use a real end date");
    endsAt = toUnix(allDay ? startOfDay(to) : to);
  }
  if (endsAt !== null && endsAt < startsAt) throw new Error("The end is before the start");
  return { startsAt, endsAt };
}

const clean = (v: string | null | undefined): string | null => {
  const s = v?.trim();
  return s ? s : null;
};

// ---- Schedule items ----

export async function createScheduleItem(workspaceId: string, raw: ScheduleItemInput): Promise<string> {
  const user = await requireUser();
  const { workspace } = assertAccess(user, workspaceId, "edit");
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) throw new Error(firstIssue(parsed.error));
  const input = parsed.data;
  const allDay = input.allDay ?? false;
  const { startsAt, endsAt } = instants(input.start, input.end, allDay);
  if (input.ownerId) assertOwner(workspace.id, input.ownerId);
  if (input.supplierId) assertSupplier(workspace.id, input.supplierId);

  const id = newId();
  db.insert(schema.scheduleItems)
    .values({
      id,
      workspaceId: workspace.id,
      title: input.title,
      notes: clean(input.notes),
      startsAt,
      endsAt,
      allDay,
      location: clean(input.location),
      supplierId: input.supplierId || null,
      ownerId: input.ownerId || null,
      createdBy: user.id,
    })
    .run();
  logActivity({ workspaceId: workspace.id, actorId: user.id, verb: "created", subjectType: "schedule", subjectId: id, subjectTitle: input.title, meta: { startsAt, allDay } });
  refresh(workspace);
  return id;
}

export async function updateScheduleItem(id: string, raw: ScheduleItemPatch): Promise<void> {
  const { user, item, workspace } = await editableItem(id);
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) throw new Error(firstIssue(parsed.error));
  const patch = parsed.data;
  const values: Partial<typeof schema.scheduleItems.$inferInsert> = {};

  if (patch.title !== undefined) values.title = patch.title;
  if (patch.location !== undefined) values.location = clean(patch.location);
  if (patch.notes !== undefined) values.notes = clean(patch.notes);
  if (patch.ownerId !== undefined) {
    if (patch.ownerId) assertOwner(workspace.id, patch.ownerId);
    values.ownerId = patch.ownerId || null;
  }
  if (patch.supplierId !== undefined) {
    if (patch.supplierId) assertSupplier(workspace.id, patch.supplierId);
    values.supplierId = patch.supplierId || null;
  }

  // Times move together: changing one of start, end or all-day re-reads the other two.
  if (patch.start !== undefined || patch.end !== undefined || patch.allDay !== undefined) {
    const allDay = patch.allDay ?? item.allDay;
    const start = patch.start ?? toInputValue(item.startsAt, allDay);
    const end = patch.end !== undefined ? patch.end : item.endsAt === null ? null : toInputValue(item.endsAt, allDay);
    const next = instants(start, end, allDay);
    values.startsAt = next.startsAt;
    values.endsAt = next.endsAt;
    values.allDay = allDay;
  }

  if (Object.keys(values).length === 0) return;
  db.update(schema.scheduleItems).set(values).where(eq(schema.scheduleItems.id, item.id)).run();
  logActivity({ workspaceId: workspace.id, actorId: user.id, verb: "updated", subjectType: "schedule", subjectId: item.id, subjectTitle: values.title ?? item.title });
  refresh(workspace);
}

export async function deleteScheduleItem(id: string): Promise<void> {
  const { user, item, workspace } = await editableItem(id);
  db.delete(schema.scheduleItems).where(eq(schema.scheduleItems.id, item.id)).run();
  logActivity({ workspaceId: workspace.id, actorId: user.id, verb: "deleted", subjectType: "schedule", subjectId: item.id, subjectTitle: item.title });
  refresh(workspace);
}

// ---- Drag to reschedule ----

/**
 * Move one entry to another day. A task gets a new due date; an item shifts by whole days,
 * keeping its clock time (`keepTime`, the default) or landing at the start of the day.
 */
export async function moveEntry(raw: MoveEntryInput): Promise<void> {
  const parsed = moveSchema.safeParse(raw);
  if (!parsed.success) throw new Error(firstIssue(parsed.error));
  const { kind, id, toIsoDate, keepTime = true } = parsed.data;
  const target = parseIsoDate(toIsoDate);
  if (!target) throw new Error("Use a real date");
  const user = await requireUser();

  if (kind === "task") {
    const task = db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).get();
    if (!task) throw new Error("Not found");
    const { workspace } = assertAccess(user, task.workspaceId, "edit");
    if (task.dueOn === toIsoDate) return;
    db.update(schema.tasks).set({ dueOn: toIsoDate }).where(eq(schema.tasks.id, task.id)).run();
    logActivity({ workspaceId: workspace.id, actorId: user.id, verb: "updated", subjectType: "task", subjectId: task.id, subjectTitle: task.title, meta: { dueOn: toIsoDate } });
    refresh(workspace);
    return;
  }

  const { item, workspace } = await editableItem(id);
  const startDate = fromUnix(item.startsAt);
  if (isoDate(startDate) === toIsoDate && keepTime) return;
  const delta = daysBetween(startDate, target);
  const startsAt = keepTime ? toUnix(addDays(startDate, delta)) : toUnix(startOfDay(target));
  const endsAt =
    item.endsAt === null
      ? null
      : keepTime
        ? toUnix(addDays(fromUnix(item.endsAt), delta))
        : startsAt + (item.endsAt - item.startsAt);
  db.update(schema.scheduleItems).set({ startsAt, endsAt }).where(eq(schema.scheduleItems.id, item.id)).run();
  logActivity({ workspaceId: workspace.id, actorId: user.id, verb: "updated", subjectType: "schedule", subjectId: item.id, subjectTitle: item.title, meta: { startsAt } });
  refresh(workspace);
}
