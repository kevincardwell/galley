import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (u: string) => { throw new Error("REDIRECT:" + u); } }));
// No request context in a unit test, and these paths are the ones under test:
// a guest upload must work with nobody signed in.
vi.mock("@/lib/auth/current", () => ({ currentUser: async () => null, requireUser: async () => { throw new Error("no user"); } }));
vi.mock("@/lib/media/process", () => ({ enqueueAsset: () => {}, ensureMediaWorker: () => false }));
vi.mock("@/lib/notify", () => ({ notify: async () => {} }));

import { db, schema } from "@/db/client";
import { shareWorkspace } from "@/lib/share/guard";
import { POST } from "@/app/api/upload/route";

const OPEN = "tok-open-0000000000000000";
const CLOSED = "tok-closed-000000000000";
const ARCHIVED = "tok-archived-00000000000";

function upload(fields: Record<string, string>, files: [string, string][] = [["logo.png", "not a real png but bytes"]]) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  for (const [name, body] of files) form.append("files", new File([body], name, { type: "image/png" }));
  return POST(new Request("http://localhost/api/upload", { method: "POST", body: form }));
}

const assetsIn = (wsId: string) => db.select().from(schema.assets).where(eq(schema.assets.workspaceId, wsId)).all();

describe("share-link guard", () => {
  beforeAll(() => {
    db.insert(schema.workspaces).values({ id: "su-open", name: "Open", slug: "su-open", shareToken: OPEN, shareUploads: true }).run();
    db.insert(schema.workspaces).values({ id: "su-closed", name: "Closed", slug: "su-closed", shareToken: CLOSED, shareUploads: false }).run();
    db.insert(schema.workspaces).values({ id: "su-arch", name: "Archived", slug: "su-arch", shareToken: ARCHIVED, shareUploads: true, archivedAt: 1 }).run();
  });

  it("only resolves a token whose workspace opted in", () => {
    expect(shareWorkspace(OPEN, "shareUploads")?.id).toBe("su-open");
    expect(shareWorkspace(CLOSED, "shareUploads")).toBeNull();
    expect(shareWorkspace("", "shareUploads")).toBeNull();
    expect(shareWorkspace("tok-does-not-exist-00000", "shareUploads")).toBeNull();
  });

  it("refuses an archived project", () => {
    expect(shareWorkspace(ARCHIVED, "shareUploads")).toBeNull();
  });

  /** Commenting and uploading are separate opt-ins: one must not imply the other. */
  it("keeps the two share capabilities apart", () => {
    db.update(schema.workspaces).set({ shareReview: true, shareUploads: false }).where(eq(schema.workspaces.id, "su-closed")).run();
    expect(shareWorkspace(CLOSED, "shareReview")?.id).toBe("su-closed");
    expect(shareWorkspace(CLOSED, "shareUploads")).toBeNull();
  });
});

describe("uploading through a share link", () => {
  it("accepts a file and records who sent it", async () => {
    const res = await upload({ shareToken: OPEN, guestName: "  Tom   Marlow " });
    expect(res.status).toBe(201);

    const rows = assetsIn("su-open");
    expect(rows).toHaveLength(1);
    expect(rows[0].filename).toBe("logo.png");
    // No account, so the name is on the asset and uploadedBy stays empty.
    expect(rows[0].uploadedBy).toBeNull();
    expect(rows[0].guestName).toBe("Tom Marlow");
    expect(rows[0].folderId).toBeNull();
  });

  it("refuses a workspace that has not opted in, without saying why", async () => {
    const res = await upload({ shareToken: CLOSED, guestName: "Tom" });
    expect(res.status).toBe(404);
    expect(assetsIn("su-closed")).toHaveLength(0);
  });

  it("refuses an unknown token", async () => {
    const res = await upload({ shareToken: "tok-nope-0000000000000000", guestName: "Tom" });
    expect(res.status).toBe(404);
  });

  it("refuses when no name is given", async () => {
    const before = assetsIn("su-open").length;
    const res = await upload({ shareToken: OPEN, guestName: "   " });
    expect(res.status).toBe(404);
    expect(assetsIn("su-open")).toHaveLength(before);
  });

  /** A share token grants one project, never a workspace id the guest names. */
  it("ignores a workspaceId supplied alongside the token", async () => {
    const before = assetsIn("su-closed").length;
    const res = await upload({ shareToken: OPEN, guestName: "Tom", workspaceId: "su-closed" });
    expect(res.status).toBe(201);
    expect(assetsIn("su-closed")).toHaveLength(before);
  });

  /**
   * The owner previewing their own share link is signed in, so an implementation
   * that only takes the guest path when nobody is logged in sends them down the
   * workspaceId branch and 404s. That is the first thing anyone tries.
   */
  it("works for someone who is signed in but posting a share token", async () => {
    const signedIn = await import("@/lib/auth/current");
    const before = assetsIn("su-open").length;
    vi.spyOn(signedIn, "currentUser").mockResolvedValueOnce({
      id: "su-owner", email: "owner@x.test", name: "Owner", passwordHash: "", isAdmin: true,
      deactivatedAt: null, lastSeenAt: null, createdAt: 0,
    });
    const res = await upload({ shareToken: OPEN, guestName: "Tom Marlow" }, [["preview.png", "bytes"]]);
    expect(res.status).toBe(201);
    expect(assetsIn("su-open")).toHaveLength(before + 1);
  });

  it("refuses a signed-out request with no token at all", async () => {
    const res = await upload({ workspaceId: "su-open" });
    expect(res.status).toBe(404);
  });

  it("rejects a file type that is not accepted", async () => {
    const before = assetsIn("su-open").length;
    const res = await upload({ shareToken: OPEN, guestName: "Tom" }, [["payload.exe", "MZ"]]);
    expect(res.status).toBe(422);
    expect(assetsIn("su-open")).toHaveLength(before);
  });

  it("stops a guest hammering the link", async () => {
    // The bucket allows 20 requests per token in ten minutes; earlier tests used some.
    let refused = 0;
    for (let i = 0; i < 25; i++) {
      const res = await upload({ shareToken: OPEN, guestName: "Tom" }, [[`shot-${i}.png`, "bytes"]]);
      if (res.status === 404) refused++;
    }
    expect(refused).toBeGreaterThan(0);
  });
});
