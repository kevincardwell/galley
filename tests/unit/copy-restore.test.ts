import { beforeAll, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { eq } from "drizzle-orm";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (u: string) => { throw new Error("REDIRECT:" + u); } }));

import { db, schema } from "@/db/client";
import { docToJSON, getRoom, joinRoom, persistRoom, replaceDoc, type RoomClient } from "@/lib/collab/hub";
import { snapshotSection } from "@/lib/collab/snapshot";
import type { TiptapDoc } from "@/lib/copy/serialize";

const para = (text: string): TiptapDoc => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

const V1 = para("The original wording.");
const V2 = para("Something the team wrote later.");

function fakeClient(id: string): RoomClient & { events: { event: string; data: object }[] } {
  const events: { event: string; data: object }[] = [];
  return { id, userId: "rex", userName: "Rex", events, send: (event, data) => events.push({ event, data }) };
}

const section = () => db.select().from(schema.sections).where(eq(schema.sections.id, "rs")).get()!;

describe("restoring a version", () => {
  beforeAll(() => {
    db.insert(schema.users).values({ id: "rex", email: "rex@x.test", name: "Rex", passwordHash: "" }).run();
    db.insert(schema.workspaces).values({ id: "rw", name: "Restore", slug: "restore" }).run();
    db.insert(schema.pages).values({ id: "rp", workspaceId: "rw", title: "Home", slug: "home" }).run();
    db.insert(schema.sections).values({ id: "rs", pageId: "rp", workspaceId: "rw", title: "Hero", content: V2, plainText: "Something the team wrote later.", wordCount: 5, version: 2 }).run();
  });

  /**
   * The bug this guards: a restore that wrote sections.content alone was invisible
   * to the editor (which is driven by the Y.Doc) and was overwritten by the next
   * persist, so the newer text came straight back.
   */
  it("changes the live document, not just the column", () => {
    const room = getRoom("rs");
    expect(room).not.toBeNull();
    expect(docToJSON(room!.doc)).toEqual(V2);

    const saved = replaceDoc("rs", V1, "rex");
    expect(saved).not.toBeNull();

    expect(docToJSON(room!.doc)).toEqual(V1);
    expect(section().content).toEqual(V1);
    expect(section().version).toBe(saved!.version);

    // The overwrite the old code suffered: persisting again must not resurrect V2.
    persistRoom(room!, "rex");
    expect(docToJSON(room!.doc)).toEqual(V1);
    expect(section().content).toEqual(V1);
  });

  it("survives a reload of the room, so the restore is durable", () => {
    const reloaded = new Y.Doc();
    Y.applyUpdate(reloaded, new Uint8Array(section().ydoc!));
    expect(docToJSON(reloaded)).toEqual(V1);
  });

  it("reaches everyone already editing", () => {
    const room = getRoom("rs")!;
    const client = fakeClient("c1");
    joinRoom(room, client);
    client.events.length = 0;

    // What an open browser already holds when the restore happens.
    const local = new Y.Doc();
    Y.applyUpdate(local, Y.encodeStateAsUpdate(room.doc));

    replaceDoc("rs", para("A third wording."), "rex");
    const update = client.events.find((e) => e.event === "update");
    expect(update).toBeDefined();

    // The broadcast is a diff, so the editor converges without reloading the page.
    Y.applyUpdate(local, new Uint8Array(Buffer.from((update!.data as { update: string }).update, "base64")));
    expect(docToJSON(local)).toEqual(para("A third wording."));
  });
});

describe("client approval", () => {
  beforeAll(() => {
    db.insert(schema.workspaces).values({ id: "aw", name: "Approval", slug: "approval" }).run();
    db.insert(schema.pages).values({ id: "ap", workspaceId: "aw", title: "Home", slug: "home" }).run();
    db.insert(schema.sections)
      .values({ id: "as", pageId: "ap", workspaceId: "aw", title: "Intro", content: V1, plainText: "The original wording.", wordCount: 3, version: 1, clientApprovedAt: 1000, clientApprovedBy: "A client" })
      .run();
  });

  const approval = () => {
    const row = db.select().from(schema.sections).where(eq(schema.sections.id, "as")).get()!;
    return { at: row.clientApprovedAt, by: row.clientApprovedBy };
  };

  it("lapses when the copy is edited after sign-off", () => {
    expect(approval()).toEqual({ at: 1000, by: "A client" });
    snapshotSection("as", V2, "rex");
    expect(approval()).toEqual({ at: null, by: null });
  });

  it("is left alone when the content did not actually change", () => {
    db.update(schema.sections).set({ clientApprovedAt: 2000, clientApprovedBy: "A client" }).where(eq(schema.sections.id, "as")).run();
    const before = db.select().from(schema.sections).where(eq(schema.sections.id, "as")).get()!.version;
    snapshotSection("as", V2, "rex");
    expect(approval()).toEqual({ at: 2000, by: "A client" });
    expect(db.select().from(schema.sections).where(eq(schema.sections.id, "as")).get()!.version).toBe(before);
  });
});
