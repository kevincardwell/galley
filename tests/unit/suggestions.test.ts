import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (u: string) => { throw new Error("REDIRECT:" + u); } }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/notify", () => ({ notify: async () => {} }));
const actor = { id: "sg-ed", email: "ed@x.test", name: "Ed", passwordHash: "", isAdmin: false, totpSecret: null, totpLastStep: null, totpRecovery: null, gitEmail: null, deactivatedAt: null, lastSeenAt: null, createdAt: 0 };
vi.mock("@/lib/auth/current", () => ({ requireUser: async () => actor, currentUser: async () => actor }));

import { db, schema } from "@/db/client";
import { guestApprovePage, guestSuggest } from "@/actions/share";
import { acceptSuggestion } from "@/actions/copy";
import { docToJSON, getRoom } from "@/lib/collab/hub";
import { applyText, docToEditableText, type TiptapDoc } from "@/lib/copy/serialize";
import { waitingOnClient } from "@/lib/queries/copy";

const TOKEN = "sg-token-00000000000000";
const CLOSED = "sg-closed-0000000000000";

const bold = { type: "bold" };
// A heading, a paragraph with a bold word, and a two-item list: the shapes a textarea cannot express.
const RICH: TiptapDoc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "What we make" }] },
    { type: "paragraph", content: [{ type: "text", text: "Built in " }, { type: "text", text: "oak", marks: [bold] }, { type: "text", text: " and ash." }] },
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Kitchens" }] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Staircases" }] }] },
      ],
    },
  ],
};
const RICH_TEXT = "What we make\n\nBuilt in oak and ash.\n\nKitchens\n\nStaircases";

describe("laying typed text back over a document", () => {
  it("round-trips unchanged text to the identical document", () => {
    expect(docToEditableText(RICH)).toBe(RICH_TEXT);
    expect(applyText(RICH, RICH_TEXT)).toEqual(RICH);
  });

  it("keeps headings, lists and untouched formatting when one paragraph is reworded", () => {
    const next = applyText(RICH, "What we make\n\nBuilt in oak and ash.\n\nFitted kitchens\n\nStaircases");
    expect(next.content![0]).toEqual(RICH.content![0]);
    expect(next.content![1]).toEqual(RICH.content![1]); // the bold survives
    expect(next.content![2].type).toBe("bulletList");
    expect(docToEditableText(next)).toBe("What we make\n\nBuilt in oak and ash.\n\nFitted kitchens\n\nStaircases");
  });

  it("falls back to plain paragraphs when a paragraph is added", () => {
    const next = applyText(RICH, `${RICH_TEXT}\n\nWardrobes`);
    expect(next.content!.every((n) => n.type === "paragraph")).toBe(true);
    expect(next.content).toHaveLength(5);
  });

  it("does not touch the document it was given", () => {
    const before = structuredClone(RICH);
    applyText(RICH, "Something else entirely\n\nb\n\nc\n\nd");
    expect(RICH).toEqual(before);
  });
});

describe("a client suggesting wording", () => {
  beforeAll(() => {
    db.insert(schema.users).values({ id: "sg-ed", email: "ed@x.test", name: "Ed", passwordHash: "" }).run();
    db.insert(schema.workspaces).values({ id: "sg-ws", name: "Suggest", slug: "sg", shareToken: TOKEN, shareReview: true }).run();
    db.insert(schema.workspaces).values({ id: "sg-closed", name: "Closed", slug: "sg-closed", shareToken: CLOSED, shareReview: false }).run();
    db.insert(schema.memberships).values({ workspaceId: "sg-ws", userId: "sg-ed", role: "editor" }).run();
    db.insert(schema.pages).values({ id: "sg-p", workspaceId: "sg-ws", title: "Home", slug: "home", position: 0 }).run();
    db.insert(schema.pages).values({ id: "sg-p2", workspaceId: "sg-closed", title: "Home", slug: "home", position: 0 }).run();
    db.insert(schema.sections).values({ id: "sg-s", pageId: "sg-p", workspaceId: "sg-ws", title: "Intro", content: RICH, plainText: RICH_TEXT, status: "review", position: 0 }).run();
    db.insert(schema.sections).values({ id: "sg-draft", pageId: "sg-p", workspaceId: "sg-ws", title: "Draft", status: "draft", position: 1 }).run();
    db.insert(schema.sections).values({ id: "sg-done", pageId: "sg-p", workspaceId: "sg-ws", title: "Done", status: "approved", position: 2 }).run();
    db.insert(schema.sections).values({ id: "sg-x", pageId: "sg-p2", workspaceId: "sg-closed", title: "Intro", content: RICH, status: "review", position: 0 }).run();
  });

  const comment = (id: string) => db.select().from(schema.comments).where(eq(schema.comments.id, id)).get()!;
  const section = (id: string) => db.select().from(schema.sections).where(eq(schema.sections.id, id)).get()!;
  const REWORDED = RICH_TEXT.replace("Kitchens", "Fitted kitchens");

  it("is refused when the link does not allow review", async () => {
    await expect(guestSuggest(CLOSED, "sg-x", "Tom", REWORDED)).rejects.toThrow("Not found");
  });

  it("is refused when nothing was changed", async () => {
    await expect(guestSuggest(TOKEN, "sg-s", "Tom", `  ${RICH_TEXT}  `)).rejects.toThrow(/same/);
  });

  let suggestionId = "";
  it("is stored with what they started from, and leaves the copy alone", async () => {
    suggestionId = (await guestSuggest(TOKEN, "sg-s", "Tom", REWORDED, "Sounds grander")).id;
    const c = comment(suggestionId);
    expect(c).toMatchObject({ guestName: "Tom", body: "Sounds grander", suggestion: REWORDED, suggestionBase: RICH_TEXT, resolvedAt: null });
    expect(docToEditableText(docToJSON(getRoom("sg-s")!.doc))).toBe(RICH_TEXT);
  });

  it("goes into the live document on accept, keeping the heading and the list", async () => {
    await acceptSuggestion(suggestionId);
    const live = docToJSON(getRoom("sg-s")!.doc);
    expect(docToEditableText(live)).toBe(REWORDED);
    expect(live.content!.map((n) => n.type)).toEqual(["heading", "paragraph", "bulletList"]);
    expect(section("sg-s").version).toBeGreaterThan(0);
    expect(comment(suggestionId).resolvedAt).not.toBeNull();
  });

  it("cannot be accepted twice", async () => {
    await expect(acceptSuggestion(suggestionId)).rejects.toThrow("Not found");
  });
});

describe("approving a whole page", () => {
  it("lists what is waiting, then approves every section that is ready and skips drafts", async () => {
    expect(waitingOnClient("sg-ws").map((w) => w.id)).toEqual(["sg-s"]);
    const { approved } = await guestApprovePage(TOKEN, "home", "Tom");
    expect(approved).toBe(2); // the review section and the studio-approved one
    expect(db.select().from(schema.sections).where(eq(schema.sections.id, "sg-draft")).get()!.clientApprovedAt).toBeNull();
    expect(waitingOnClient("sg-ws")).toEqual([]);
    expect((await guestApprovePage(TOKEN, "home", "Tom")).approved).toBe(0);
  });

  it("is refused without review or without a name", async () => {
    await expect(guestApprovePage(CLOSED, "home", "Tom")).rejects.toThrow("Not found");
    await expect(guestApprovePage(TOKEN, "home", "  ")).rejects.toThrow(/name/);
  });
});

describe("history for words that were never saved", () => {
  it("keeps the replaced wording as a version even when the section had no history", async () => {
    // Seeded content: a version number but no section_versions row, like the sample project.
    db.insert(schema.sections).values({ id: "sg-seed", pageId: "sg-p", workspaceId: "sg-ws", title: "Seeded", content: RICH, plainText: RICH_TEXT, wordCount: 11, version: 1, status: "draft", position: 3 }).run();
    const id = (await guestSuggest(TOKEN, "sg-seed", "Tom", RICH_TEXT.replace("Staircases", "Stairs"))).id;
    await acceptSuggestion(id);
    const versions = db.select().from(schema.sectionVersions).where(eq(schema.sectionVersions.sectionId, "sg-seed")).all().sort((a, b) => a.version - b.version);
    expect(versions.map((v) => v.version)).toEqual([1, 2]);
    expect(versions[0].plainText).toBe(RICH_TEXT);
  });
});
