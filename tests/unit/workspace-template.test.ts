import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (u: string) => { throw new Error("REDIRECT:" + u); } }));

import { db, schema } from "@/db/client";
import { copyStructure } from "@/lib/workspaces/template";

describe("starting a project from an existing one", () => {
  beforeAll(() => {
    db.insert(schema.users).values({ id: "tpl-u", email: "tpl@x.test", name: "Tpl", passwordHash: "" }).run();
    db.insert(schema.users).values({ id: "tpl-other", email: "other@x.test", name: "Other", passwordHash: "" }).run();
    db.insert(schema.workspaces).values({ id: "tpl-from", name: "Brochure site", slug: "brochure" }).run();
    db.insert(schema.workspaces).values({ id: "tpl-to", name: "New client", slug: "new-client" }).run();

    db.insert(schema.taskSections).values({ id: "tpl-sec-a", workspaceId: "tpl-from", name: "Design", position: 0 }).run();
    db.insert(schema.taskSections).values({ id: "tpl-sec-b", workspaceId: "tpl-from", name: "Launch", position: 1 }).run();
    db.insert(schema.tasks).values({ id: "tpl-t1", workspaceId: "tpl-from", sectionId: "tpl-sec-a", title: "Moodboard", body: "old notes", status: "done", assigneeId: "tpl-other", dueOn: "2026-01-01", position: 0, completedAt: 1 }).run();
    db.insert(schema.tasks).values({ id: "tpl-t2", workspaceId: "tpl-from", sectionId: "tpl-sec-b", title: "Point the DNS", position: 0 }).run();

    db.insert(schema.pages).values({ id: "tpl-p1", workspaceId: "tpl-from", title: "Home", slug: "home", position: 0 }).run();
    db.insert(schema.sections)
      .values({ id: "tpl-s1", pageId: "tpl-p1", workspaceId: "tpl-from", title: "Hero", content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Old client copy" }] }] }, plainText: "Old client copy", wordCount: 3, status: "approved", clientApprovedAt: 99, clientApprovedBy: "Someone", position: 0 })
      .run();

    db.transaction((tx) => copyStructure(tx, "tpl-from", "tpl-to", "tpl-u"));
  });

  const tasks = () => db.select().from(schema.tasks).where(eq(schema.tasks.workspaceId, "tpl-to")).all();

  it("copies the task sections and task titles", () => {
    const sections = db.select().from(schema.taskSections).where(eq(schema.taskSections.workspaceId, "tpl-to")).orderBy(schema.taskSections.position).all();
    expect(sections.map((s) => s.name)).toEqual(["Design", "Launch"]);
    expect(tasks().map((t) => t.title).sort()).toEqual(["Moodboard", "Point the DNS"]);
  });

  it("leaves behind everything that belonged to the old project", () => {
    const moodboard = tasks().find((t) => t.title === "Moodboard")!;
    expect(moodboard.status).toBe("todo");
    expect(moodboard.completedAt).toBeNull();
    expect(moodboard.assigneeId).toBeNull();
    expect(moodboard.dueOn).toBeNull();
    expect(moodboard.body).toBe("");
    expect(moodboard.createdBy).toBe("tpl-u");
  });

  it("copies pages and section titles but not the copy itself", () => {
    const page = db.select().from(schema.pages).where(eq(schema.pages.workspaceId, "tpl-to")).get()!;
    expect(page.title).toBe("Home");
    expect(page.slug).toBe("home");
    const section = db.select().from(schema.sections).where(eq(schema.sections.workspaceId, "tpl-to")).get()!;
    expect(section.title).toBe("Hero");
    expect(section.plainText).toBe("");
    expect(section.wordCount).toBe(0);
    expect(section.status).toBe("draft");
    // A previous client's sign-off must never appear on a new project.
    expect(section.clientApprovedAt).toBeNull();
    expect(section.clientApprovedBy).toBeNull();
  });

  it("does not disturb the project it copied from", () => {
    expect(db.select().from(schema.tasks).where(eq(schema.tasks.workspaceId, "tpl-from")).all()).toHaveLength(2);
    expect(db.select().from(schema.sections).where(eq(schema.sections.id, "tpl-s1")).get()!.plainText).toBe("Old client copy");
  });
});
