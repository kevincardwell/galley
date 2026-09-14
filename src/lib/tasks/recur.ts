import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { newId } from "@/lib/ids";
import { addDays, addMonths, isoDate, parseIsoDate, startOfDay } from "@/lib/dates";
import type { TaskRepeat } from "@/db/schema";

const STEP: Record<TaskRepeat, (d: Date) => Date> = {
  weekly: (d) => addDays(d, 7),
  fortnightly: (d) => addDays(d, 14),
  monthly: (d) => addMonths(d, 1),
  quarterly: (d) => addMonths(d, 3),
  yearly: (d) => addMonths(d, 12),
};

/**
 * The next due date strictly after `from`, and never in the past: a monthly
 * check ticked off six months late restarts from this month rather than
 * spawning an instance that is already overdue.
 */
export function nextDue(repeat: TaskRepeat, from: Date, today: Date): string {
  let next = STEP[repeat](from);
  while (next < today) next = STEP[repeat](next);
  return isoDate(next);
}

/**
 * Completing a repeating task creates the next one.
 *
 * The schedule moves to the new task rather than being copied, so reopening and
 * re-completing the old one cannot spawn a duplicate. Carried over: section,
 * title, description, assignee and an unticked copy of the checklist — the
 * shape of the job. Not carried over: comments and attachments, which belong to
 * the occasion rather than the routine.
 *
 * Returns the new task's id, or null when the task does not repeat.
 */
export function spawnNextOccurrence(taskId: string, userId: string, now = new Date()): string | null {
  const task = db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId)).get();
  if (!task?.repeatEvery) return null;
  const today = startOfDay(now);
  const id = newId();
  const dueOn = nextDue(task.repeatEvery, parseIsoDate(task.dueOn) ?? today, today);
  const checklist = db
    .select()
    .from(schema.taskChecklist)
    .where(eq(schema.taskChecklist.taskId, task.id))
    .orderBy(schema.taskChecklist.position)
    .all();

  db.transaction((tx) => {
    tx.insert(schema.tasks)
      .values({
        id,
        workspaceId: task.workspaceId,
        sectionId: task.sectionId,
        title: task.title,
        body: task.body,
        assigneeId: task.assigneeId,
        dueOn,
        repeatEvery: task.repeatEvery,
        position: task.position,
        createdBy: userId,
      })
      .run();
    for (const item of checklist) {
      tx.insert(schema.taskChecklist).values({ id: newId(), taskId: id, text: item.text, position: item.position }).run();
    }
    tx.update(schema.tasks).set({ repeatEvery: null }).where(eq(schema.tasks.id, task.id)).run();
  });
  return id;
}
