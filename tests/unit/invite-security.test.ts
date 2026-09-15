import { beforeAll, describe, expect, it, vi } from "vitest";

const redirected = { to: "" };
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NOT_FOUND"); },
  redirect: (to: string) => { redirected.to = to; throw new Error("REDIRECT"); },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

// No session cookie: the caller is a stranger holding the link.
vi.mock("@/lib/auth/current", () => ({ currentUser: async () => null, requireUser: async () => { throw new Error("no user"); } }));
const created: string[] = [];
vi.mock("@/lib/auth/session", () => ({
  SESSION_COOKIE: "galley_session",
  createSession: async (userId: string) => { created.push(userId); },
  destroySession: async () => {},
}));

import { db, schema } from "@/db/client";
import { acceptInviteAction } from "@/actions/auth";
import { hashPassword } from "@/lib/auth/password";

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};
const future = () => Math.floor(Date.now() / 1000) + 86400;

describe("invite redemption", () => {
  beforeAll(async () => {
    db.insert(schema.users).values({ id: "inv-admin", email: "admin@inv.test", name: "Admin", passwordHash: "", isAdmin: true }).run();
    db.insert(schema.users).values({ id: "inv-victim", email: "victim@inv.test", name: "Victim", passwordHash: await hashPassword("the-real-password") }).run();
    db.insert(schema.invites).values({ id: "inv-1", token: "token-for-existing-user", email: "victim@inv.test", invitedBy: "inv-admin", expiresAt: future() }).run();
    db.insert(schema.invites).values({ id: "inv-2", token: "token-for-new-user", email: "fresh@inv.test", invitedBy: "inv-admin", expiresAt: future() }).run();
    // A link made never to expire: expiresAt is null, which must not read as "already expired".
    db.insert(schema.invites).values({ id: "inv-3", token: "token-that-never-expires", email: "forever@inv.test", invitedBy: "inv-admin", expiresAt: null }).run();
  });

  it("refuses to sign a stranger in as an account that already exists", async () => {
    const result = await acceptInviteAction(undefined, form({ token: "token-for-existing-user", name: "Not The Victim", password: "anything-at-all" }));
    expect(result?.error).toMatch(/already has an account/i);
    expect(created).not.toContain("inv-victim");
    const invite = db.select().from(schema.invites).all().find((i) => i.id === "inv-1");
    expect(invite?.acceptedAt).toBeNull();
  });

  it("still creates a brand new account from a valid invite", async () => {
    await expect(acceptInviteAction(undefined, form({ token: "token-for-new-user", name: "Fresh Person", password: "another-long-password" }))).rejects.toThrow("REDIRECT");
    const user = db.select().from(schema.users).all().find((u) => u.email === "fresh@inv.test");
    expect(user).toBeDefined();
    expect(created).toContain(user!.id);
  });

  it("accepts an invite that was set never to expire", async () => {
    await expect(acceptInviteAction(undefined, form({ token: "token-that-never-expires", name: "Forever", password: "another-long-password" }))).rejects.toThrow("REDIRECT");
    expect(db.select().from(schema.users).all().some((u) => u.email === "forever@inv.test")).toBe(true);
  });

  it("will not let the same invite be used twice", async () => {
    const again = await acceptInviteAction(undefined, form({ token: "token-for-new-user", name: "Someone Else", password: "another-long-password" }));
    expect(again?.error).toMatch(/no longer valid|already been used/i);
  });
});
