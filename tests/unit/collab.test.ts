import { beforeAll, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { eq } from "drizzle-orm";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (u: string) => { throw new Error("REDIRECT:" + u); } }));

import { db, schema } from "@/db/client";
import { applyClientUpdate, docToJSON, evictRoom, getRoom, joinRoom, leaveRoom, persistRoom, setAwareness, type RoomClient } from "@/lib/collab/hub";
import { countCollabUpdates } from "@/lib/queries/copy";
import type { TiptapDoc } from "@/lib/copy/serialize";

const SEED: TiptapDoc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Hero" }] },
    { type: "paragraph", content: [{ type: "text", text: "Hello " }, { type: "text", text: "world", marks: [{ type: "bold" }] }] },
  ],
};

/** A client that edits a copy of the room document and returns the update the browser would POST. */
function clientEdit(room: ReturnType<typeof getRoom>, edit: (frag: Y.XmlFragment) => void): Uint8Array {
  if (!room) throw new Error("no room");
  const local = new Y.Doc();
  Y.applyUpdate(local, Y.encodeStateAsUpdate(room.doc));
  const before = Y.encodeStateVector(local);
  local.transact(() => edit(local.getXmlFragment("default")));
  return Y.encodeStateAsUpdate(local, before);
}

function fakeClient(id: string, userId: string): RoomClient & { events: { event: string; data: object }[] } {
  const events: { event: string; data: object }[] = [];
  return { id, userId, userName: userId, events, send: (event, data) => events.push({ event, data }) };
}

describe("collaboration hub", () => {
  beforeAll(() => {
    db.insert(schema.users).values({ id: "ann", email: "ann@x.test", name: "Ann", passwordHash: "" }).run();
    db.insert(schema.workspaces).values({ id: "cw", name: "Collab", slug: "collab" }).run();
    db.insert(schema.pages).values({ id: "cp", workspaceId: "cw", title: "Home", slug: "home" }).run();
    db.insert(schema.sections).values({ id: "cs", pageId: "cp", workspaceId: "cw", title: "Hero", content: SEED, plainText: "Hero\nHello world", wordCount: 3, version: 1 }).run();
    db.insert(schema.sectionVersions).values({ id: "v1", sectionId: "cs", version: 1, content: SEED, plainText: "Hero\nHello world", wordCount: 3, createdBy: "ann" }).run();
  });

  it("seeds a room from the section's Tiptap JSON and stores the seed", () => {
    const room = getRoom("cs");
    expect(room).not.toBeNull();
    expect(docToJSON(room!.doc)).toEqual(SEED);
    const row = db.select({ ydoc: schema.sections.ydoc }).from(schema.sections).where(eq(schema.sections.id, "cs")).get();
    expect(row?.ydoc).toBeInstanceOf(Buffer);
    expect(getRoom("missing")).toBeNull();
  });

  it("applies a client update, logs it and fans it out to the other clients only", () => {
    const room = getRoom("cs")!;
    const a = fakeClient("client-a", "ann");
    const b = fakeClient("client-b", "ann");
    joinRoom(room, a);
    joinRoom(room, b);
    expect(a.events[0]?.event).toBe("sync");

    const update = clientEdit(room, (frag) => {
      const p = new Y.XmlElement("paragraph");
      p.insert(0, [new Y.XmlText("Second thought")]);
      frag.push([p]);
    });
    applyClientUpdate(room, update, { clientId: "client-a", userId: "ann" });

    expect(docToJSON(room.doc).content).toHaveLength(3);
    expect(countCollabUpdates("cs")).toBe(1);
    expect(a.events.filter((e) => e.event === "update")).toHaveLength(0);
    expect(b.events.filter((e) => e.event === "update")).toHaveLength(1);
  });

  it("relays awareness and clears it when a client leaves", () => {
    const room = getRoom("cs")!;
    const b = room.clients.get("client-b") as ReturnType<typeof fakeClient>;
    setAwareness(room, "client-a", { clientId: 7, clock: 1, state: { user: { name: "Ann" } } });
    expect(b.events.at(-1)).toEqual({ event: "awareness", data: { section: "cs", clientId: 7, clock: 1, state: { user: { name: "Ann" } } } });
    leaveRoom(room, "client-a");
    expect(b.events.at(-1)).toEqual({ event: "awareness", data: { section: "cs", clientId: 7, clock: 1, state: null } });
  });

  it("persists: compacts the log, snapshots the columns, records a version", () => {
    const room = getRoom("cs")!;
    const saved = persistRoom(room);
    expect(saved?.version).toBe(2);
    expect(countCollabUpdates("cs")).toBe(0);
    const s = db.select().from(schema.sections).where(eq(schema.sections.id, "cs")).get()!;
    expect(s.version).toBe(2);
    expect(s.updatedBy).toBe("ann");
    expect(s.plainText).toContain("Second thought");
    expect(s.wordCount).toBe(5);
    const versions = db.select().from(schema.sectionVersions).where(eq(schema.sectionVersions.sectionId, "cs")).all();
    expect(versions.map((v) => v.version).sort()).toEqual([1, 2]);
    const acts = db.select().from(schema.activity).where(eq(schema.activity.subjectId, "cs")).all();
    expect(acts).toHaveLength(1);

    // Nothing changed since: persisting again is a no-op for the version.
    expect(persistRoom(room, "ann")?.version).toBe(2);
    expect(db.select().from(schema.activity).where(eq(schema.activity.subjectId, "cs")).all()).toHaveLength(1);
  });

  it("round-trips: an evicted room reloads from ydoc plus the remaining log", () => {
    let room = getRoom("cs")!;
    const update = clientEdit(room, (frag) => {
      const first = frag.get(0) as Y.XmlElement;
      (first.get(0) as Y.XmlText).insert(0, "Big ");
    });
    applyClientUpdate(room, update, { clientId: "client-b", userId: "ann" });
    expect(countCollabUpdates("cs")).toBe(1);
    const expected = docToJSON(room.doc);

    leaveRoom(room, "client-b");
    evictRoom(room);
    room = getRoom("cs")!;
    expect(docToJSON(room.doc)).toEqual(expected);
    expect(expected.content?.[0]).toEqual({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Big Hero" }] });
    // Eviction persisted, so the log is empty and the section is on version 3.
    expect(countCollabUpdates("cs")).toBe(0);
    expect(db.select({ v: schema.sections.version }).from(schema.sections).where(eq(schema.sections.id, "cs")).get()?.v).toBe(3);
    evictRoom(room);
  });
});
