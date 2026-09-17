import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const jar = vi.hoisted(() => ({ current: "keep-me" as string | null }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.current ? { name, value: jar.current } : undefined) }),
}));
vi.mock("@/lib/auth/current", () => ({
  currentUser: async () => null,
  requireUser: async () => {
    const { db, schema } = await import("@/db/client");
    const { eq } = await import("drizzle-orm");
    const user = db.select().from(schema.users).where(eq(schema.users.id, "u-2fa")).get();
    if (!user) throw new Error("no user");
    return user;
  },
}));

import { db, schema } from "@/db/client";
import { disableTotp, enableTotp } from "@/actions/account";

const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const EXPIRES = 9_999_999_999;

const sessions = () =>
  db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.userId, "u-2fa"))
    .all()
    .map((s) => s.id)
    .sort();
const secret = () => db.select({ s: schema.users.totpSecret }).from(schema.users).where(eq(schema.users.id, "u-2fa")).get()?.s;

describe("changing two-factor signs out the sessions that predate it", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(59_000);
    // No password hash: a proxy-created account, so the confirmation check passes without argon2.
    db.insert(schema.users).values({ id: "u-2fa", email: "two@x.test", name: "Two", passwordHash: "" }).run();
    for (const id of ["keep-me", "other-1", "other-2"]) db.insert(schema.sessions).values({ id, userId: "u-2fa", expiresAt: EXPIRES }).run();
  });
  afterAll(() => vi.useRealTimers());

  it("enabling it keeps the session that made the change", async () => {
    const res = await enableTotp(SECRET, "287082", "");
    expect(res.ok).toBe(true);
    expect(sessions()).toEqual(["keep-me"]);
    expect(secret()).toBe(SECRET);
  });

  it("disabling it does the same", async () => {
    db.insert(schema.sessions).values({ id: "other-3", userId: "u-2fa", expiresAt: EXPIRES }).run();
    const res = await disableTotp("");
    expect(res.ok).toBe(true);
    expect(sessions()).toEqual(["keep-me"]);
    expect(secret()).toBeNull();
  });
});
