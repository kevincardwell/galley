import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: () => { throw new Error("REDIRECT"); } }));

import { db, schema } from "@/db/client";
import { listWorkspacesFor } from "@/lib/queries/workspaces";
import type { User } from "@/db/schema";

const admin: User = { id: "wc-admin", email: "wc@x.test", name: "Counter", passwordHash: "", isAdmin: true, deactivatedAt: null, lastSeenAt: null, createdAt: 0 };

describe("workspace grid counts", () => {
  beforeAll(() => {
    db.insert(schema.users).values({ id: admin.id, email: admin.email, name: admin.name, passwordHash: "", isAdmin: true }).run();
    db.insert(schema.workspaces).values({ id: "wc-ws", name: "Counted", slug: "counted" }).run();
    db.insert(schema.taskSections).values({ id: "wc-sec", workspaceId: "wc-ws", name: "Design", position: 0 }).run();
    db.insert(schema.tasks).values({ id: "wc-t1", workspaceId: "wc-ws", sectionId: "wc-sec", title: "Open one", status: "todo" }).run();
    db.insert(schema.tasks).values({ id: "wc-t2", workspaceId: "wc-ws", sectionId: "wc-sec", title: "Open two", status: "doing" }).run();
    db.insert(schema.tasks).values({ id: "wc-t3", workspaceId: "wc-ws", sectionId: "wc-sec", title: "Finished", status: "done" }).run();
    db.insert(schema.pages).values({ id: "wc-page", workspaceId: "wc-ws", title: "Home", slug: "home", position: 0 }).run();
    db.insert(schema.sections).values({ id: "wc-s1", pageId: "wc-page", workspaceId: "wc-ws", title: "Hero", status: "approved", position: 0 }).run();
    db.insert(schema.sections).values({ id: "wc-s2", pageId: "wc-page", workspaceId: "wc-ws", title: "Intro", status: "draft", position: 1 }).run();
    db.insert(schema.assets).values({ id: "wc-a1", workspaceId: "wc-ws", kind: "image", filename: "a.jpg", mime: "image/jpeg", bytes: 10 }).run();
  });

  it("counts open tasks, approved sections and assets for the right workspace", () => {
    const row = listWorkspacesFor(admin).find((r) => r.ws.id === "wc-ws");
    expect(row).toBeDefined();
    expect(row!.openTasks).toBe(2);
    expect(row!.approvedSections).toBe(1);
    expect(row!.totalSections).toBe(2);
    expect(row!.assetCount).toBe(1);
  });
});
