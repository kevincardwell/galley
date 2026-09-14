import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (u: string) => { throw new Error("REDIRECT:" + u); } }));

const sent: { to: string; subject: string; text: string }[] = [];
let sendOk = true;
vi.mock("@/lib/email", () => ({
  isEmailConfigured: () => true,
  sendEmail: async (input: { to: string; subject: string; text: string }) => {
    if (!sendOk) return { ok: false as const, error: "provider down" };
    sent.push(input);
    return { ok: true as const, via: "smtp" };
  },
}));
vi.mock("@/lib/queries/admin", () => ({ resolveBaseUrl: async () => "https://galley.test" }));

import { db, schema } from "@/db/client";
import { buildDigest, digestCandidates, dueForDigest, sendWorkspaceDigest } from "@/lib/digest";

const WS = "dg-ws";
const ws = () => db.select().from(schema.workspaces).where(eq(schema.workspaces.id, WS)).get()!;
const act = (verb: string, subjectType: string, subjectId: string, title: string, at: number, meta?: object) =>
  db.insert(schema.activity).values({ workspaceId: WS, actorId: null, verb, subjectType, subjectId, subjectTitle: title, createdAt: at, meta: meta ?? null }).run();

const NOW = new Date("2026-09-14T09:00:00");
const nowSec = Math.floor(NOW.getTime() / 1000);
const daysAgo = (n: number) => nowSec - n * 86400;

describe("building a client digest", () => {
  beforeAll(() => {
    db.insert(schema.workspaces).values({ id: WS, name: "Marlow & Finch", slug: "dg", shareToken: "dg-token-000000000000", clientEmail: "tom@example.test" }).run();
    db.insert(schema.pages).values({ id: "dg-p", workspaceId: WS, title: "Home", slug: "home", position: 0 }).run();
    db.insert(schema.sections).values({ id: "dg-s1", pageId: "dg-p", workspaceId: WS, title: "Hero", status: "review", position: 0 }).run();
    db.insert(schema.sections).values({ id: "dg-s2", pageId: "dg-p", workspaceId: WS, title: "Intro", status: "draft", position: 1 }).run();
    db.insert(schema.sections).values({ id: "dg-s3", pageId: "dg-p", workspaceId: WS, title: "Signed off", status: "review", clientApprovedAt: 1, clientApprovedBy: "Tom", position: 2 }).run();

    act("updated", "section", "dg-s1", "Hero", daysAgo(1));
    act("updated", "section", "dg-s1", "Hero", daysAgo(2)); // same thing twice: one line
    act("uploaded", "asset", "dg-a1", "kitchen.jpg", daysAgo(3));
    act("uploaded", "asset", "dg-a2", "their-logo.png", daysAgo(1), { guest: "Tom Marlow" }); // they sent it
    act("completed", "task", "dg-t1", "Point the DNS", daysAgo(1)); // studio business
    act("updated", "section", "dg-old", "Ancient history", daysAgo(30)); // outside the window
  });

  const digest = () => buildDigest(WS, daysAgo(7));

  it("says what changed, once per thing, newest first", () => {
    expect(digest().changes).toEqual(["Rewrote Hero", "Added kitchen.jpg"]);
  });

  it("leaves out tasks, which the client never sees", () => {
    expect(digest().changes.join(" ")).not.toContain("DNS");
  });

  it("does not report the client's own uploads back to them", () => {
    expect(digest().changes.join(" ")).not.toContain("their-logo.png");
  });

  it("ignores anything older than the window", () => {
    expect(digest().changes.join(" ")).not.toContain("Ancient history");
  });

  it("lists only sections in review that are not already approved", () => {
    expect(digest().waitingOn).toEqual(["Home › Hero"]);
  });
});

describe("sending a client digest", () => {
  it("sends, and records when", async () => {
    sent.length = 0;
    const ok = await sendWorkspaceDigest(ws(), NOW);
    expect(ok).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("tom@example.test");
    expect(sent[0].subject).toBe("Marlow & Finch: 1 thing to look at");
    expect(sent[0].text).toContain("Rewrote Hero");
    expect(sent[0].text).toContain("Home › Hero");
    expect(sent[0].text).toContain("https://galley.test/share/dg-token-000000000000");
    expect(ws().digestSentAt).toBe(nowSec);
  });

  /**
   * "Waiting on you" is not time-bounded, so a second send finds the same list
   * and mails the client again. Found by clicking "Send now" twice: the guard
   * has to live in the send, not only in the scheduler that calls it.
   */
  it("does not send the same project twice in a day", async () => {
    sent.length = 0;
    expect(await sendWorkspaceDigest(ws(), NOW)).toBe(false);
    expect(sent).toHaveLength(0);
    expect(dueForDigest(ws(), NOW)).toBe(false);
  });

  it("is due again a day later", () => {
    expect(dueForDigest(ws(), new Date(NOW.getTime() + 25 * 3600 * 1000))).toBe(true);
  });

  it("says nothing when there is nothing to say", async () => {
    db.insert(schema.workspaces).values({ id: "dg-quiet", name: "Quiet", slug: "dg-quiet", shareToken: "dg-quiet-token-00000", clientEmail: "q@example.test" }).run();
    sent.length = 0;
    const quiet = db.select().from(schema.workspaces).where(eq(schema.workspaces.id, "dg-quiet")).get()!;
    expect(await sendWorkspaceDigest(quiet, NOW)).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("skips a project with no client address", async () => {
    db.insert(schema.workspaces).values({ id: "dg-noemail", name: "No address", slug: "dg-noemail", shareToken: "dg-noemail-token-000" }).run();
    const row = db.select().from(schema.workspaces).where(eq(schema.workspaces.id, "dg-noemail")).get()!;
    expect(await sendWorkspaceDigest(row, NOW)).toBe(false);
  });

  it("skips a project with no share link to point at", async () => {
    db.insert(schema.workspaces).values({ id: "dg-nolink", name: "No link", slug: "dg-nolink", clientEmail: "n@example.test" }).run();
    const row = db.select().from(schema.workspaces).where(eq(schema.workspaces.id, "dg-nolink")).get()!;
    expect(await sendWorkspaceDigest(row, NOW)).toBe(false);
  });

  /** A failed send must not move the marker, or that week's news is lost for good. */
  it("keeps the marker where it was when the provider fails", async () => {
    act("updated", "section", "dg-s2", "Intro", nowSec - 60);
    const before = ws().digestSentAt;
    const later = new Date(NOW.getTime() + 25 * 3600 * 1000);
    sendOk = false;
    expect(await sendWorkspaceDigest(ws(), later)).toBe(false);
    sendOk = true;
    expect(ws().digestSentAt).toBe(before);
  });

  it("only offers projects that could actually receive one", () => {
    const ids = digestCandidates().map((w) => w.id);
    expect(ids).toContain(WS);
    expect(ids).not.toContain("dg-noemail");
    expect(ids).not.toContain("dg-nolink");
  });
});
