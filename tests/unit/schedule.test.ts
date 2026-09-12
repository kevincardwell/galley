// The calendar works in local days; pin a timezone so the fixtures below mean one thing.
process.env.TZ = "Europe/London";

import { beforeAll, describe, expect, it } from "vitest";
import { db, schema } from "@/db/client";
import type { User } from "@/db/schema";
import { addDays, isoDate, startOfDay, toUnix } from "@/lib/dates";
import { editableWorkspaceIds, itemDetail, scheduleWindow, upcoming } from "@/lib/queries/schedule";

const ids = {
  owner: "cal-owner",
  viewer: "cal-viewer",
  stranger: "cal-stranger",
  admin: "cal-admin",
  studio: "cal-ws-studio",
  joinery: "cal-ws-joinery",
  archived: "cal-ws-archived",
};

const user = (id: string, isAdmin = false): User => ({
  id,
  email: `${id}@x.test`,
  name: id,
  passwordHash: "",
  isAdmin,
  deactivatedAt: null,
  lastSeenAt: null,
  createdAt: 0,
});

const at = (y: number, m: number, d: number, h = 0, min = 0) => toUnix(new Date(y, m - 1, d, h, min));
const win = (as: User, from: Date, to: Date, workspaceId?: string) => scheduleWindow({ user: as, from, to, workspaceId });

// September 2026 as the calendar would load it.
const from = new Date(2026, 8, 1);
const to = new Date(2026, 9, 1);

beforeAll(() => {
  for (const [id, isAdmin] of [[ids.owner, false], [ids.viewer, false], [ids.stranger, false], [ids.admin, true]] as const) {
    db.insert(schema.users).values({ id, email: `${id}@x.test`, name: id, passwordHash: "", isAdmin }).run();
  }
  db.insert(schema.workspaces).values({ id: ids.studio, name: "Studio site", slug: "cal-studio", accent: "#2F6B4F", shareToken: "cal-token" }).run();
  db.insert(schema.workspaces).values({ id: ids.joinery, name: "Joinery", slug: "cal-joinery", accent: "#B5533C" }).run();
  db.insert(schema.workspaces).values({ id: ids.archived, name: "Old job", slug: "cal-old", archivedAt: 1 }).run();
  for (const ws of [ids.studio, ids.joinery, ids.archived]) {
    db.insert(schema.memberships).values({ workspaceId: ws, userId: ids.owner, role: "editor" }).run();
  }
  db.insert(schema.memberships).values({ workspaceId: ids.studio, userId: ids.viewer, role: "viewer" }).run();

  db.insert(schema.taskSections).values({ id: "cal-sec", workspaceId: ids.studio, name: "Build" }).run();
  db.insert(schema.tasks).values({ id: "cal-task-due", workspaceId: ids.studio, sectionId: "cal-sec", title: "Send the proof", dueOn: "2026-09-15", assigneeId: ids.owner }).run();
  db.insert(schema.tasks).values({ id: "cal-task-late", workspaceId: ids.studio, sectionId: "cal-sec", title: "Old thing", dueOn: "2026-08-01" }).run();
  db.insert(schema.tasks).values({ id: "cal-task-none", workspaceId: ids.studio, sectionId: "cal-sec", title: "No date" }).run();

  db.insert(schema.scheduleItems)
    .values({ id: "cal-item-visit", workspaceId: ids.studio, title: "Site visit", startsAt: at(2026, 9, 15, 10, 0), endsAt: at(2026, 9, 15, 11, 30), location: "Bank Quay", ownerId: ids.owner })
    .run();
  db.insert(schema.scheduleItems)
    .values({ id: "cal-item-allday", workspaceId: ids.studio, title: "Copy deadline", startsAt: at(2026, 9, 15, 0, 0), allDay: true })
    .run();
  // Starts in August, runs into September: the window has to catch it by overlap, not by start.
  db.insert(schema.scheduleItems)
    .values({ id: "cal-item-long", workspaceId: ids.studio, title: "Scaffold hire", startsAt: at(2026, 8, 28, 8, 0), endsAt: at(2026, 9, 3, 17, 0) })
    .run();
  db.insert(schema.scheduleItems)
    .values({ id: "cal-item-far", workspaceId: ids.studio, title: "Handover", startsAt: at(2026, 11, 2, 9, 0) })
    .run();
  db.insert(schema.scheduleItems)
    .values({ id: "cal-item-other", workspaceId: ids.joinery, title: "Photographer arrives", startsAt: at(2026, 9, 16, 9, 0) })
    .run();
  db.insert(schema.scheduleItems)
    .values({ id: "cal-item-archived", workspaceId: ids.archived, title: "Ancient", startsAt: at(2026, 9, 17, 9, 0) })
    .run();
});

describe("scheduleWindow", () => {
  it("turns a task due date into an all-day entry that links to the task", () => {
    const task = win(user(ids.owner), from, to, ids.studio).find((e) => e.id === "cal-task-due")!;
    expect(task.kind).toBe("task");
    expect(task.allDay).toBe(true);
    expect(task.end).toBeNull();
    expect(isoDate(new Date(task.start * 1000))).toBe("2026-09-15");
    expect(task.href).toBe("/w/cal-studio/tasks?task=cal-task-due");
    expect(task.workspaceName).toBe("Studio site");
    expect(task.accent).toBe("#2F6B4F");
    expect(task.ownerName).toBe(ids.owner);
    expect(task.status).toBe("todo");
  });

  it("keeps a schedule item's own times, location and owner", () => {
    const item = win(user(ids.owner), from, to, ids.studio).find((e) => e.id === "cal-item-visit")!;
    expect(item.kind).toBe("item");
    expect(item.allDay).toBe(false);
    expect(item.start).toBe(at(2026, 9, 15, 10, 0));
    expect(item.end).toBe(at(2026, 9, 15, 11, 30));
    expect(item.location).toBe("Bank Quay");
    expect(item.ownerName).toBe(ids.owner);
    expect(item.href).toBe("/w/cal-studio/calendar?date=2026-09-15&item=cal-item-visit");
  });

  it("includes anything overlapping the window and excludes the rest", () => {
    const got = win(user(ids.owner), from, to, ids.studio).map((e) => e.id);
    expect(got).toContain("cal-item-long"); // started in August, still running in September
    expect(got).not.toContain("cal-item-far");
    expect(got).not.toContain("cal-task-late");
    expect(got).not.toContain("cal-task-none");
  });

  it("sorts by start, all-day first within a day", () => {
    const day = win(user(ids.owner), new Date(2026, 8, 15), new Date(2026, 8, 16), ids.studio);
    expect(day.map((e) => e.id)).toEqual(["cal-item-allday", "cal-task-due", "cal-item-visit"]);
  });

  it("shows every project the caller can see when no workspace is named", () => {
    const got = win(user(ids.owner), from, to).map((e) => e.id);
    expect(got).toContain("cal-item-visit");
    expect(got).toContain("cal-item-other");
    expect(got).not.toContain("cal-item-archived"); // archived projects stay off the everything calendar
  });

  it("scopes to one project when asked", () => {
    const got = win(user(ids.owner), from, to, ids.joinery).map((e) => e.id);
    expect(got).toEqual(["cal-item-other"]);
  });

  it("still loads an archived project when the caller opened it directly", () => {
    expect(win(user(ids.owner), from, to, ids.archived).map((e) => e.id)).toEqual(["cal-item-archived"]);
  });

  it("shows a stranger nothing at all", () => {
    expect(win(user(ids.stranger), from, to)).toEqual([]);
    expect(win(user(ids.stranger), from, to, ids.studio).length).toBeGreaterThan(0); // scoping trusts the caller's check
  });

  it("lets a viewer read the project they are in but not the one they are not", () => {
    const got = win(user(ids.viewer), from, to).map((e) => e.workspaceId);
    expect(new Set(got)).toEqual(new Set([ids.studio]));
  });

  it("gives an admin everything without a membership", () => {
    const got = win(user(ids.admin, true), from, to).map((e) => e.id);
    expect(got).toContain("cal-item-visit");
    expect(got).toContain("cal-item-other");
  });

  it("returns nothing for an unknown workspace", () => {
    expect(win(user(ids.admin, true), from, to, "nope")).toEqual([]);
  });
});

describe("upcoming", () => {
  it("runs from today forward for the number of days asked", () => {
    const today = startOfDay(new Date());
    db.insert(schema.scheduleItems)
      .values({ id: "cal-item-today", workspaceId: ids.studio, title: "Stand-up", startsAt: toUnix(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0)) })
      .run();
    db.insert(schema.scheduleItems)
      .values({ id: "cal-item-yesterday", workspaceId: ids.studio, title: "Gone", startsAt: toUnix(addDays(today, -1)) })
      .run();
    db.insert(schema.scheduleItems)
      .values({ id: "cal-item-next-month", workspaceId: ids.studio, title: "Later", startsAt: toUnix(addDays(today, 40)) })
      .run();

    const got = upcoming({ user: user(ids.owner), days: 30, workspaceId: ids.studio }).map((e) => e.id);
    expect(got).toContain("cal-item-today");
    expect(got).not.toContain("cal-item-yesterday");
    expect(got).not.toContain("cal-item-next-month");
  });
});

describe("itemDetail", () => {
  it("reads one item back in full", () => {
    const detail = itemDetail("cal-item-visit")!;
    expect(detail).toMatchObject({
      id: "cal-item-visit",
      workspaceId: ids.studio,
      workspaceSlug: "cal-studio",
      title: "Site visit",
      allDay: false,
      location: "Bank Quay",
      ownerId: ids.owner,
      supplierId: null,
    });
  });
  it("is null for something that is not there", () => {
    expect(itemDetail("nope")).toBeNull();
  });
});

describe("editableWorkspaceIds", () => {
  it("lists the projects a person may change", () => {
    expect(new Set(editableWorkspaceIds(user(ids.owner)))).toEqual(new Set([ids.studio, ids.joinery, ids.archived]));
    expect(editableWorkspaceIds(user(ids.viewer))).toEqual([]);
    expect(editableWorkspaceIds(user(ids.stranger))).toEqual([]);
    expect(editableWorkspaceIds(user(ids.admin, true)).length).toBeGreaterThanOrEqual(3);
  });
});
