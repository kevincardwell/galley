import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as Y from "yjs";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (u: string) => { throw new Error("REDIRECT:" + u); } }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/notify", () => ({ notify: async () => {} }));

import { db, schema } from "@/db/client";
import { guestWriteSection } from "@/actions/share";
import { docToJSON, getRoom } from "@/lib/collab/hub";
import { asDoc, docToEditableText, textToDoc, tiptapToText } from "@/lib/copy/serialize";

const TOKEN = "gw-token-00000000000000";
const CLOSED = "gw-closed-0000000000000";

const section = (id: string) => db.select().from(schema.sections).where(eq(schema.sections.id, id)).get()!;

describe("turning typed text into a document", () => {
  it("makes a paragraph per blank-line-separated block", () => {
    const doc = textToDoc("First para.\n\nSecond para.");
    expect(doc.content).toHaveLength(2);
    expect(docToEditableText(doc)).toBe("First para.\n\nSecond para.");
  });

  it("keeps single newlines inside a paragraph as line breaks", () => {
    const doc = textToDoc("Line one\nLine two");
    expect(doc.content).toHaveLength(1);
    expect(tiptapToText(doc)).toBe("Line one\nLine two");
  });

  it("treats whitespace-only text as empty", () => {
    expect(textToDoc("   \n\n  ").content).toEqual([]);
  });
});

describe("a client writing a section", () => {
  beforeAll(() => {
    db.insert(schema.workspaces).values({ id: "gw-ws", name: "Write", slug: "gw", shareToken: TOKEN, shareReview: true }).run();
    db.insert(schema.workspaces).values({ id: "gw-closed", name: "Closed", slug: "gw-closed", shareToken: CLOSED, shareReview: false }).run();
    db.insert(schema.pages).values({ id: "gw-p", workspaceId: "gw-ws", title: "About", slug: "about", position: 0 }).run();
    db.insert(schema.pages).values({ id: "gw-p2", workspaceId: "gw-closed", title: "About", slug: "about", position: 0 }).run();
    // handed over
    db.insert(schema.sections).values({ id: "gw-open", pageId: "gw-p", workspaceId: "gw-ws", title: "Our story", clientCanWrite: true, position: 0 }).run();
    // not handed over
    db.insert(schema.sections).values({ id: "gw-shut", pageId: "gw-p", workspaceId: "gw-ws", title: "Hero", clientCanWrite: false, position: 1 }).run();
    // handed over, but the workspace has review off
    db.insert(schema.sections).values({ id: "gw-noreview", pageId: "gw-p2", workspaceId: "gw-closed", title: "Hero", clientCanWrite: true, position: 0 }).run();
  });

  it("writes the words, and they survive a reload of the room", async () => {
    const res = await guestWriteSection(TOKEN, "gw-open", "  Tom  Marlow ", "We started in a shed.\n\nNow there are four of us.");
    expect(res.version).toBeGreaterThan(0);

    const row = section("gw-open");
    expect(docToEditableText(asDoc(row.content))).toBe("We started in a shed.\n\nNow there are four of us.");
    expect(row.wordCount).toBe(11);

    // Written through the live document, so the editor sees it and the next
    // persist cannot put the old text back.
    expect(docToJSON(getRoom("gw-open")!.doc)).toEqual(row.content);
    const reloaded = new Y.Doc();
    Y.applyUpdate(reloaded, new Uint8Array(row.ydoc!));
    expect(tiptapToText(docToJSON(reloaded))).toContain("shed");
  });

  it("keeps a version, so the studio can see what changed", async () => {
    await guestWriteSection(TOKEN, "gw-open", "Tom Marlow", "A second draft, shorter.");
    const versions = db.select().from(schema.sectionVersions).where(eq(schema.sectionVersions.sectionId, "gw-open")).all();
    expect(versions.length).toBeGreaterThanOrEqual(2);
    expect(tiptapToText(asDoc(section("gw-open").content))).toBe("A second draft, shorter.");
  });

  it("records who wrote it without inventing a user account", () => {
    const row = db.select().from(schema.activity).where(eq(schema.activity.subjectId, "gw-open")).all().at(-1)!;
    expect(row.actorId).toBeNull();
    expect(row.meta).toMatchObject({ guest: "Tom Marlow", clientWrote: true });
  });

  it("refuses a section the studio has not handed over", async () => {
    await expect(guestWriteSection(TOKEN, "gw-shut", "Tom", "Sneaking this in")).rejects.toThrow("Not found");
    expect(tiptapToText(asDoc(section("gw-shut").content))).toBe("");
  });

  it("refuses when the workspace has client review switched off", async () => {
    await expect(guestWriteSection(CLOSED, "gw-noreview", "Tom", "Nope")).rejects.toThrow("Not found");
    expect(tiptapToText(asDoc(section("gw-noreview").content))).toBe("");
  });

  it("refuses an unknown token", async () => {
    await expect(guestWriteSection("gw-nope-000000000000000", "gw-open", "Tom", "Nope")).rejects.toThrow("Not found");
  });

  it("refuses a section id from another project", async () => {
    await expect(guestWriteSection(TOKEN, "gw-noreview", "Tom", "Nope")).rejects.toThrow("Not found");
  });

  it("insists on a name and on some words", async () => {
    await expect(guestWriteSection(TOKEN, "gw-open", "   ", "Something")).rejects.toThrow();
    await expect(guestWriteSection(TOKEN, "gw-open", "Tom", "   ")).rejects.toThrow("Write something first");
  });
});
