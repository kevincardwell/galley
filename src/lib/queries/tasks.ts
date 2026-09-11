import "server-only";
import { and, asc, eq, gt, inArray, ne, or, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { User } from "@/db/schema";
import { listWorkspacesFor } from "@/lib/queries/workspaces";
import type { ChecklistItem, MyTaskGroup, SectionWithTasks, TaskAttachment, TaskComment, TaskItem } from "@/components/tasks/types";

function groupBy<T>(rows: T[], key: (row: T) => string | null): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    if (!k) continue;
    const list = out.get(k);
    if (list) list.push(row);
    else out.set(k, [row]);
  }
  return out;
}

/** Every task in a workspace with its checklist, attachments and comments, ordered by position. */
export function loadTasks(workspaceId: string): TaskItem[] {
  const rows = db
    .select({ t: schema.tasks, assigneeName: schema.users.name })
    .from(schema.tasks)
    .leftJoin(schema.users, eq(schema.users.id, schema.tasks.assigneeId))
    .where(eq(schema.tasks.workspaceId, workspaceId))
    .orderBy(asc(schema.tasks.position), asc(schema.tasks.createdAt))
    .all();
  const ids = rows.map((r) => r.t.id);
  if (ids.length === 0) return [];

  const checklist = groupBy(
    db.select().from(schema.taskChecklist).where(inArray(schema.taskChecklist.taskId, ids)).orderBy(asc(schema.taskChecklist.position)).all(),
    (c) => c.taskId,
  );
  const attachments = groupBy(
    db
      .select({ attachmentId: schema.attachments.id, taskId: schema.attachments.taskId, assetId: schema.assets.id, filename: schema.assets.filename, kind: schema.assets.kind })
      .from(schema.attachments)
      .innerJoin(schema.assets, eq(schema.assets.id, schema.attachments.assetId))
      .where(inArray(schema.attachments.taskId, ids))
      .orderBy(asc(schema.attachments.createdAt))
      .all(),
    (a) => a.taskId,
  );
  const comments = groupBy(
    db
      .select({ c: schema.comments, authorName: schema.users.name })
      .from(schema.comments)
      .leftJoin(schema.users, eq(schema.users.id, schema.comments.authorId))
      .where(inArray(schema.comments.taskId, ids))
      .orderBy(asc(schema.comments.createdAt))
      .all(),
    (r) => r.c.taskId,
  );

  return rows.map(({ t, assigneeName }) => ({
    id: t.id,
    workspaceId: t.workspaceId,
    sectionId: t.sectionId,
    title: t.title,
    body: t.body,
    status: t.status,
    assigneeId: t.assigneeId,
    assigneeName,
    dueOn: t.dueOn,
    position: t.position,
    createdAt: t.createdAt,
    completedAt: t.completedAt,
    checklist: (checklist.get(t.id) ?? []).map<ChecklistItem>((c) => ({ id: c.id, text: c.text, done: c.done, position: c.position })),
    attachments: (attachments.get(t.id) ?? []).map<TaskAttachment>((a) => ({ attachmentId: a.attachmentId, assetId: a.assetId, filename: a.filename, kind: a.kind })),
    comments: (comments.get(t.id) ?? []).map<TaskComment>(({ c, authorName }) => ({
      id: c.id,
      body: c.body,
      authorId: c.authorId,
      authorName,
      createdAt: c.createdAt,
      resolvedAt: c.resolvedAt,
    })),
  }));
}

/** Sections in order, each with its tasks in order. */
export function loadSections(workspaceId: string): SectionWithTasks[] {
  const sections = db
    .select()
    .from(schema.taskSections)
    .where(eq(schema.taskSections.workspaceId, workspaceId))
    .orderBy(asc(schema.taskSections.position), asc(schema.taskSections.name))
    .all();
  const bySection = groupBy(loadTasks(workspaceId), (t) => t.sectionId);
  return sections.map((s) => ({ id: s.id, name: s.name, position: s.position, tasks: bySection.get(s.id) ?? [] }));
}

/**
 * Tasks assigned to the user across every workspace they can see: open ones ordered by due date
 * (undated last), plus anything they finished in the last day so a tick does not make the row vanish.
 */
export function listMyTasks(user: User): MyTaskGroup[] {
  const workspaces = listWorkspacesFor(user).map(({ ws }) => ws).sort((a, b) => a.name.localeCompare(b.name));
  const ids = workspaces.map((w) => w.id);
  if (ids.length === 0) return [];
  const dayAgo = Math.floor(Date.now() / 1000) - 86400;
  const rows = db
    .select({ t: schema.tasks, sectionName: schema.taskSections.name })
    .from(schema.tasks)
    .innerJoin(schema.taskSections, eq(schema.taskSections.id, schema.tasks.sectionId))
    .where(
      and(
        inArray(schema.tasks.workspaceId, ids),
        eq(schema.tasks.assigneeId, user.id),
        or(ne(schema.tasks.status, "done"), gt(schema.tasks.completedAt, dayAgo)),
      ),
    )
    .orderBy(
      sql`${schema.tasks.status} = 'done'`,
      sql`${schema.tasks.dueOn} is null`,
      asc(schema.tasks.dueOn),
      asc(schema.tasks.position),
    )
    .all();
  const byWorkspace = groupBy(rows, (r) => r.t.workspaceId);
  return workspaces
    .filter((w) => byWorkspace.has(w.id))
    .map((w) => ({
      workspace: { id: w.id, slug: w.slug, name: w.name, accent: w.accent },
      tasks: (byWorkspace.get(w.id) ?? []).map(({ t, sectionName }) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueOn: t.dueOn,
        sectionName,
        completedAt: t.completedAt,
      })),
    }));
}
