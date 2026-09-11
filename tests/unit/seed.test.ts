import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

// The seed queues thumbnails after committing; the queue is background work we do not need here.
const { enqueueAsset } = vi.hoisted(() => ({ enqueueAsset: vi.fn(() => true) }));
vi.mock("@/lib/media/process", () => ({ enqueueAsset }));

import { db, schema, UPLOAD_DIR } from "@/db/client";
import { createSampleWorkspace } from "@/lib/seed/sample";
import { eq } from "drizzle-orm";

const TABLES = {
  taskSections: schema.taskSections,
  tasks: schema.tasks,
  pages: schema.pages,
  sections: schema.sections,
  assets: schema.assets,
  activity: schema.activity,
};

describe("sample workspace", () => {
  let workspaceId = "";
  let slug = "";
  let queued = 0;

  beforeAll(async () => {
    db.insert(schema.users).values({ id: "owner", email: "owner@x.test", name: "Owner", passwordHash: "", isAdmin: true }).run();
    ({ workspaceId, slug } = await createSampleWorkspace("owner"));
    queued = enqueueAsset.mock.calls.length;
  }, 30_000);

  const count = (table: keyof typeof TABLES) => db.select().from(TABLES[table]).all().filter((r) => r.workspaceId === workspaceId).length;

  it("creates one workspace the owner manages", () => {
    const ws = db.select().from(schema.workspaces).where(eq(schema.workspaces.id, workspaceId)).get();
    expect(ws?.name).toBe("Marlow & Finch Joinery");
    expect(ws?.status).toBe("building");
    expect(slug).toBe("marlow-finch-joinery");
    expect(db.select().from(schema.workspaces).all()).toHaveLength(1);
    const m = db.select().from(schema.memberships).where(eq(schema.memberships.userId, "owner")).all();
    expect(m).toEqual([expect.objectContaining({ workspaceId, role: "manager" })]);
  });

  it("fills in tasks, copy and files", () => {
    expect(count("taskSections")).toBe(4);
    expect(count("tasks")).toBeGreaterThanOrEqual(8);
    expect(count("pages")).toBe(4);
    expect(count("sections")).toBeGreaterThanOrEqual(10);
    expect(count("assets")).toBe(4);
    expect(db.select().from(schema.taskChecklist).all().length).toBeGreaterThan(0);
    expect(db.select().from(schema.attachments).all()).toHaveLength(2);
    expect(count("activity")).toBeGreaterThanOrEqual(3);
  });

  it("computes plain text and word counts for every section", () => {
    for (const s of db.select().from(schema.sections).all()) {
      expect(s.plainText.length).toBeGreaterThan(0);
      expect(s.wordCount).toBeGreaterThan(0);
    }
    const statuses = new Set(db.select({ s: schema.sections.status }).from(schema.sections).all().map((r) => r.s));
    expect(statuses).toEqual(new Set(["draft", "review", "approved"]));
  });

  it("writes the originals to disk and queues them for processing", () => {
    const assets = db.select().from(schema.assets).all();
    for (const a of assets) {
      const file = path.join(UPLOAD_DIR, workspaceId, a.id, "original.jpg");
      expect(fs.existsSync(file)).toBe(true);
      expect(fs.statSync(file).size).toBe(a.bytes);
    }
    expect(queued).toBe(4);
    expect(db.select().from(schema.assetTags).all().length).toBeGreaterThanOrEqual(4);
  });

  it("gets a fresh slug when run again", async () => {
    const second = await createSampleWorkspace("owner");
    expect(second.slug).toBe("marlow-finch-joinery-2");
  }, 30_000);
});
