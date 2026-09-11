"use server";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notifyAssigned, notifyMentions } from "@/lib/notify";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { TASK_STATUSES, type TaskSection, type Task, type User, type Workspace } from "@/db/schema";
import { requireUser } from "@/lib/auth/current";
import { assertAccess } from "@/lib/permissions";
import { newId } from "@/lib/ids";
import { logActivity } from "@/lib/activity";
import type { TaskPatch } from "@/components/tasks/types";

const nowSec = () => Math.floor(Date.now() / 1000);

const titleSchema = z.string().trim().min(1, "Give the task a title").max(200, "Keep the title under 200 characters");
const sectionNameSchema = z.string().trim().min(1, "Give the section a name").max(80, "Keep the name under 80 characters");
const textSchema = z.string().trim().min(1, "Write something first").max(2000, "Keep it under 2000 characters");
const patchSchema = z.object({
  title: titleSchema.optional(),
  body: z.string().max(20000, "The description is too long").optional(),
  status: z.enum(TASK_STATUSES).optional(),
  assigneeId: z.string().nullable().optional(),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a real date").nullable().optional(),
  sectionId: z.string().optional(),
});

function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Check the form";
}

/** Revalidate every view that shows this workspace's tasks. */
function refresh(workspace: Workspace) {
  revalidatePath(`/w/${workspace.slug}`, "layout");
  revalidatePath("/me/tasks");
}

type TaskContext = { user: User; task: Task; workspace: Workspace };

/** Load a task and check the caller may edit its workspace. Unknown or foreign tasks read as "Not found". */
async function editableTask(taskId: string): Promise<TaskContext> {
  const user = await requireUser();
  const task = db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId)).get();
  if (!task) throw new Error("Not found");
  const { workspace } = assertAccess(user, task.workspaceId, "edit");
  return { user, task, workspace };
}

async function editableSection(sectionId: string): Promise<{ user: User; section: TaskSection; workspace: Workspace }> {
  const user = await requireUser();
  const section = db.select().from(schema.taskSections).where(eq(schema.taskSections.id, sectionId)).get();
  if (!section) throw new Error("Not found");
  const { workspace } = assertAccess(user, section.workspaceId, "edit");
  return { user, section, workspace };
}

function sectionIn(workspaceId: string, sectionId: string): TaskSection {
  const section = db
    .select()
    .from(schema.taskSections)
    .where(and(eq(schema.taskSections.id, sectionId), eq(schema.taskSections.workspaceId, workspaceId)))
    .get();
  if (!section) throw new Error("That section no longer exists");
  return section;
}

function nextTaskPosition(sectionId: string): number {
  const row = db
    .select({ max: sql<number>`coalesce(max(${schema.tasks.position}), -1)` })
    .from(schema.tasks)
    .where(eq(schema.tasks.sectionId, sectionId))
    .get();
  return (row?.max ?? -1) + 1;
}

function assertAssignable(workspaceId: string, userId: string) {
  const member = db
    .select({ userId: schema.memberships.userId })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.workspaceId, workspaceId), eq(schema.memberships.userId, userId)))
    .get();
  if (member) return;
  const admin = db.select({ isAdmin: schema.users.isAdmin }).from(schema.users).where(eq(schema.users.id, userId)).get();
  if (!admin?.isAdmin) throw new Error("That person is not in this workspace");
}

// ---- Tasks ----

export async function createTask(workspaceId: string, sectionId: string, rawTitle: string): Promise<string> {
  const user = await requireUser();
  const { workspace } = assertAccess(user, workspaceId, "edit");
  const parsed = titleSchema.safeParse(rawTitle);
  if (!parsed.success) throw new Error(firstIssue(parsed.error));
  const section = sectionIn(workspace.id, sectionId);
  const id = newId();
  db.insert(schema.tasks)
    .values({ id, workspaceId: workspace.id, sectionId: section.id, title: parsed.data, position: nextTaskPosition(section.id), createdBy: user.id })
    .run();
  logActivity({ workspaceId: workspace.id, actorId: user.id, verb: "created", subjectType: "task", subjectId: id, subjectTitle: parsed.data });
  refresh(workspace);
  return id;
}

export async function updateTask(taskId: string, rawPatch: TaskPatch): Promise<void> {
  const { user, task, workspace } = await editableTask(taskId);
  const parsed = patchSchema.safeParse(rawPatch);
  if (!parsed.success) throw new Error(firstIssue(parsed.error));
  const patch = parsed.data;
  const values: Partial<typeof schema.tasks.$inferInsert> = {};

  if (patch.title !== undefined) values.title = patch.title;
  if (patch.body !== undefined) values.body = patch.body;
  if (patch.dueOn !== undefined) values.dueOn = patch.dueOn;
  if (patch.assigneeId !== undefined) {
    if (patch.assigneeId) assertAssignable(workspace.id, patch.assigneeId);
    values.assigneeId = patch.assigneeId;
  }
  if (patch.status !== undefined && patch.status !== task.status) {
    values.status = patch.status;
    values.completedAt = patch.status === "done" ? nowSec() : null;
  }
  if (patch.sectionId !== undefined && patch.sectionId !== task.sectionId) {
    const section = sectionIn(workspace.id, patch.sectionId);
    values.sectionId = section.id;
    values.position = nextTaskPosition(section.id);
  }
  if (Object.keys(values).length === 0) return;

  db.update(schema.tasks).set(values).where(eq(schema.tasks.id, task.id)).run();
  const href = `/w/${workspace.slug}/tasks?task=${task.id}`;
  if (values.assigneeId && values.assigneeId !== task.assigneeId) {
    await notifyAssigned({ taskId: task.id, taskTitle: values.title ?? task.title, workspaceId: workspace.id, assigneeId: values.assigneeId, actorId: user.id, href });
  }
  if (typeof values.body === "string" && values.body !== task.body) {
    await notifyMentions({ text: values.body, workspaceId: workspace.id, actorId: user.id, href, context: `task “${values.title ?? task.title}”` });
  }
  const completed = values.status === "done";
  logActivity({
    workspaceId: workspace.id,
    actorId: user.id,
    verb: completed ? "completed" : "updated",
    subjectType: "task",
    subjectId: task.id,
    subjectTitle: values.title ?? task.title,
    meta: { fields: Object.keys(values) },
  });
  refresh(workspace);
}

export async function toggleDone(taskId: string): Promise<void> {
  const { user, task, workspace } = await editableTask(taskId);
  const done = task.status !== "done";
  db.update(schema.tasks)
    .set({ status: done ? "done" : "todo", completedAt: done ? nowSec() : null })
    .where(eq(schema.tasks.id, task.id))
    .run();
  logActivity({ workspaceId: workspace.id, actorId: user.id, verb: done ? "completed" : "reopened", subjectType: "task", subjectId: task.id, subjectTitle: task.title });
  refresh(workspace);
}

export async function deleteTask(taskId: string): Promise<void> {
  const { user, task, workspace } = await editableTask(taskId);
  db.delete(schema.tasks).where(eq(schema.tasks.id, task.id)).run();
  logActivity({ workspaceId: workspace.id, actorId: user.id, verb: "deleted", subjectType: "task", subjectId: task.id, subjectTitle: task.title });
  refresh(workspace);
}

/** Set the order of tasks within one section. Ids that are not in this workspace are ignored. */
export async function reorderTasks(workspaceId: string, sectionId: string, orderedIds: string[]): Promise<void> {
  const user = await requireUser();
  const { workspace } = assertAccess(user, workspaceId, "edit");
  const section = sectionIn(workspace.id, sectionId);
  db.transaction((tx) => {
    orderedIds.forEach((id, i) => {
      tx.update(schema.tasks)
        .set({ position: i, sectionId: section.id })
        .where(and(eq(schema.tasks.id, id), eq(schema.tasks.workspaceId, workspace.id)))
        .run();
    });
  });
  refresh(workspace);
}

/** Move a task into a section at a given index (clamped), renumbering that section. */
export async function moveTask(taskId: string, sectionId: string, index: number): Promise<void> {
  const { user, task, workspace } = await editableTask(taskId);
  const section = sectionIn(workspace.id, sectionId);
  db.transaction((tx) => {
    const others = tx
      .select({ id: schema.tasks.id })
      .from(schema.tasks)
      .where(and(eq(schema.tasks.sectionId, section.id), ne(schema.tasks.id, task.id)))
      .orderBy(asc(schema.tasks.position), asc(schema.tasks.createdAt))
      .all()
      .map((r) => r.id);
    const at = Math.max(0, Math.min(Math.floor(index), others.length));
    others.splice(at, 0, task.id);
    others.forEach((id, i) => {
      tx.update(schema.tasks).set({ position: i, sectionId: section.id }).where(eq(schema.tasks.id, id)).run();
    });
  });
  if (section.id !== task.sectionId) {
    logActivity({ workspaceId: workspace.id, actorId: user.id, verb: "moved", subjectType: "task", subjectId: task.id, subjectTitle: task.title, meta: { to: section.name } });
  }
  refresh(workspace);
}

// ---- Sections ----

export async function createSection(workspaceId: string, rawName: string): Promise<string> {
  const user = await requireUser();
  const { workspace } = assertAccess(user, workspaceId, "edit");
  const parsed = sectionNameSchema.safeParse(rawName);
  if (!parsed.success) throw new Error(firstIssue(parsed.error));
  const row = db
    .select({ max: sql<number>`coalesce(max(${schema.taskSections.position}), -1)` })
    .from(schema.taskSections)
    .where(eq(schema.taskSections.workspaceId, workspace.id))
    .get();
  const id = newId();
  db.insert(schema.taskSections).values({ id, workspaceId: workspace.id, name: parsed.data, position: (row?.max ?? -1) + 1 }).run();
  refresh(workspace);
  return id;
}

export async function renameSection(sectionId: string, rawName: string): Promise<void> {
  const { section, workspace } = await editableSection(sectionId);
  const parsed = sectionNameSchema.safeParse(rawName);
  if (!parsed.success) throw new Error(firstIssue(parsed.error));
  db.update(schema.taskSections).set({ name: parsed.data }).where(eq(schema.taskSections.id, section.id)).run();
  refresh(workspace);
}

/** Delete a section; its tasks move to the end of the first remaining section. The last section cannot be deleted. */
export async function deleteSection(sectionId: string): Promise<void> {
  const { section, workspace } = await editableSection(sectionId);
  const target = db
    .select()
    .from(schema.taskSections)
    .where(and(eq(schema.taskSections.workspaceId, workspace.id), ne(schema.taskSections.id, section.id)))
    .orderBy(asc(schema.taskSections.position), asc(schema.taskSections.name))
    .get();
  if (!target) throw new Error("Keep at least one section");
  db.transaction((tx) => {
    const moving = tx
      .select({ id: schema.tasks.id })
      .from(schema.tasks)
      .where(eq(schema.tasks.sectionId, section.id))
      .orderBy(asc(schema.tasks.position), asc(schema.tasks.createdAt))
      .all();
    const base = nextTaskPosition(target.id);
    moving.forEach(({ id }, i) => {
      tx.update(schema.tasks).set({ sectionId: target.id, position: base + i }).where(eq(schema.tasks.id, id)).run();
    });
    tx.delete(schema.taskSections).where(eq(schema.taskSections.id, section.id)).run();
  });
  refresh(workspace);
}

export async function reorderSections(workspaceId: string, orderedIds: string[]): Promise<void> {
  const user = await requireUser();
  const { workspace } = assertAccess(user, workspaceId, "edit");
  db.transaction((tx) => {
    orderedIds.forEach((id, i) => {
      tx.update(schema.taskSections)
        .set({ position: i })
        .where(and(eq(schema.taskSections.id, id), eq(schema.taskSections.workspaceId, workspace.id)))
        .run();
    });
  });
  refresh(workspace);
}

// ---- Checklist ----

async function editableChecklistItem(itemId: string) {
  const item = db.select().from(schema.taskChecklist).where(eq(schema.taskChecklist.id, itemId)).get();
  if (!item) throw new Error("Not found");
  const ctx = await editableTask(item.taskId);
  return { ...ctx, item };
}

export async function addChecklistItem(taskId: string, rawText: string): Promise<string> {
  const { task, workspace } = await editableTask(taskId);
  const parsed = textSchema.safeParse(rawText);
  if (!parsed.success) throw new Error(firstIssue(parsed.error));
  const row = db
    .select({ max: sql<number>`coalesce(max(${schema.taskChecklist.position}), -1)` })
    .from(schema.taskChecklist)
    .where(eq(schema.taskChecklist.taskId, task.id))
    .get();
  const id = newId();
  db.insert(schema.taskChecklist).values({ id, taskId: task.id, text: parsed.data, position: (row?.max ?? -1) + 1 }).run();
  refresh(workspace);
  return id;
}

export async function toggleChecklistItem(itemId: string): Promise<void> {
  const { item, workspace } = await editableChecklistItem(itemId);
  db.update(schema.taskChecklist).set({ done: !item.done }).where(eq(schema.taskChecklist.id, item.id)).run();
  refresh(workspace);
}

export async function renameChecklistItem(itemId: string, rawText: string): Promise<void> {
  const { item, workspace } = await editableChecklistItem(itemId);
  const parsed = textSchema.safeParse(rawText);
  if (!parsed.success) throw new Error(firstIssue(parsed.error));
  db.update(schema.taskChecklist).set({ text: parsed.data }).where(eq(schema.taskChecklist.id, item.id)).run();
  refresh(workspace);
}

export async function deleteChecklistItem(itemId: string): Promise<void> {
  const { item, workspace } = await editableChecklistItem(itemId);
  db.delete(schema.taskChecklist).where(eq(schema.taskChecklist.id, item.id)).run();
  refresh(workspace);
}

// ---- Comments ----

export async function addComment(taskId: string, rawBody: string): Promise<string> {
  const { user, task, workspace } = await editableTask(taskId);
  const parsed = textSchema.safeParse(rawBody);
  if (!parsed.success) throw new Error(firstIssue(parsed.error));
  const id = newId();
  db.insert(schema.comments).values({ id, workspaceId: workspace.id, taskId: task.id, body: parsed.data, authorId: user.id }).run();
  logActivity({ workspaceId: workspace.id, actorId: user.id, verb: "commented on", subjectType: "task", subjectId: task.id, subjectTitle: task.title });
  await notifyMentions({ text: parsed.data, workspaceId: workspace.id, actorId: user.id, href: `/w/${workspace.slug}/tasks?task=${task.id}`, context: `a comment on “${task.title}”` });
  refresh(workspace);
  return id;
}

export async function resolveComment(commentId: string, resolved = true): Promise<void> {
  const comment = db.select().from(schema.comments).where(eq(schema.comments.id, commentId)).get();
  if (!comment?.taskId) throw new Error("Not found");
  const { workspace } = await editableTask(comment.taskId);
  db.update(schema.comments).set({ resolvedAt: resolved ? nowSec() : null }).where(eq(schema.comments.id, comment.id)).run();
  refresh(workspace);
}
