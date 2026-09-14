import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (u: string) => { throw new Error("REDIRECT:" + u); } }));

import { db, schema } from "@/db/client";
import { nextDue, spawnNextOccurrence } from "@/lib/tasks/recur";

const d = (iso: string) => new Date(`${iso}T00:00:00`);

describe("nextDue", () => {
  it("steps forward by the right interval", () => {
    expect(nextDue("weekly", d("2026-09-14"), d("2026-09-14"))).toBe("2026-09-21");
    expect(nextDue("fortnightly", d("2026-09-14"), d("2026-09-14"))).toBe("2026-09-28");
    expect(nextDue("monthly", d("2026-09-14"), d("2026-09-14"))).toBe("2026-10-14");
    expect(nextDue("quarterly", d("2026-09-14"), d("2026-09-14"))).toBe("2026-12-14");
    expect(nextDue("yearly", d("2026-09-14"), d("2026-09-14"))).toBe("2027-09-14");
  });

  /** A care plan ticked off six months late should not spawn something already overdue. */
  it("skips past missed occurrences instead of landing in the past", () => {
    expect(nextDue("monthly", d("2026-01-10"), d("2026-09-14"))).toBe("2026-10-10");
    expect(nextDue("weekly", d("2026-01-01"), d("2026-09-14"))).toBe("2026-09-17");
  });

  it("keeps the day of the month across a short month", () => {
    expect(nextDue("monthly", d("2026-01-31"), d("2026-01-31"))).toBe("2026-02-28");
  });
});

describe("spawning the next occurrence", () => {
  beforeAll(() => {
    db.insert(schema.users).values({ id: "rec-u", email: "rec@x.test", name: "Rec", passwordHash: "" }).run();
    db.insert(schema.workspaces).values({ id: "rec-w", name: "Care plan", slug: "care-plan" }).run();
    db.insert(schema.taskSections).values({ id: "rec-s", workspaceId: "rec-w", name: "Monthly", position: 0 }).run();
  });

  const mkTask = (id: string, repeat: "monthly" | null, dueOn: string | null) => {
    db.insert(schema.tasks)
      .values({ id, workspaceId: "rec-w", sectionId: "rec-s", title: "Plugin updates", body: "Check the staging site after", status: "todo", assigneeId: "rec-u", dueOn, repeatEvery: repeat, position: 3 })
      .run();
    return id;
  };
  const tasks = () => db.select().from(schema.tasks).where(eq(schema.tasks.workspaceId, "rec-w")).all();

  it("creates the next task and hands the schedule over to it", () => {
    mkTask("rec-t1", "monthly", "2026-09-10");
    db.insert(schema.taskChecklist).values({ id: "rec-c1", taskId: "rec-t1", text: "Take a backup", done: true, position: 0 }).run();

    const newId = spawnNextOccurrence("rec-t1", "rec-u", d("2026-09-14"));
    expect(newId).not.toBeNull();

    const next = tasks().find((t) => t.id === newId)!;
    expect(next.dueOn).toBe("2026-10-10");
    expect(next.title).toBe("Plugin updates");
    expect(next.body).toBe("Check the staging site after");
    expect(next.assigneeId).toBe("rec-u");
    expect(next.status).toBe("todo");
    expect(next.repeatEvery).toBe("monthly");

    // The checklist comes across unticked; the old task keeps its own.
    const items = db.select().from(schema.taskChecklist).where(eq(schema.taskChecklist.taskId, newId!)).all();
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe("Take a backup");
    expect(items[0].done).toBe(false);

    // The schedule moved, so the completed task is now a one-off.
    expect(tasks().find((t) => t.id === "rec-t1")!.repeatEvery).toBeNull();
  });

  it("does not spawn a duplicate when the old task is completed again", () => {
    const before = tasks().length;
    expect(spawnNextOccurrence("rec-t1", "rec-u", d("2026-09-14"))).toBeNull();
    expect(tasks()).toHaveLength(before);
  });

  it("ignores tasks that do not repeat", () => {
    mkTask("rec-t2", null, "2026-09-10");
    const before = tasks().length;
    expect(spawnNextOccurrence("rec-t2", "rec-u", d("2026-09-14"))).toBeNull();
    expect(tasks()).toHaveLength(before);
  });

  it("counts from today when the task had no due date", () => {
    mkTask("rec-t3", "monthly", null);
    const id = spawnNextOccurrence("rec-t3", "rec-u", d("2026-09-14"));
    expect(tasks().find((t) => t.id === id)!.dueOn).toBe("2026-10-14");
  });
});
