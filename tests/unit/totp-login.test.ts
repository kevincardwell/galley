import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NOT_FOUND"); },
  redirect: (to: string) => { throw new Error(`REDIRECT:${to}`); },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth/current", () => ({ currentUser: async () => null, requireUser: async () => { throw new Error("no user"); } }));
// The throttle reads request headers, which there are none of here.
vi.mock("@/lib/auth/throttle", () => ({ isThrottled: async () => false, recordFailure: async () => {}, clearFailures: async () => {} }));

const completed: string[] = [];
let pendingUserId: string | null = "totp-user";
vi.mock("@/lib/auth/session", () => ({
  SESSION_COOKIE: "galley_session",
  createSession: async () => {},
  destroySession: async () => {},
  completePendingSession: async (id: string) => { completed.push(id); },
  getPendingSession: async () => {
    if (!pendingUserId) return null;
    const { db, schema } = await import("@/db/client");
    const { eq } = await import("drizzle-orm");
    const user = db.select().from(schema.users).where(eq(schema.users.id, pendingUserId)).get();
    return user ? { id: "pending-session", user } : null;
  },
}));

import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { verifyTotpAction } from "@/actions/auth";
import { hashRecovery } from "@/lib/auth/totp";

/** RFC 6238's secret; at 59s past the epoch the app shows 287082. */
const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const RECOVERY = "abcd-efgh-jkmn";

const form = (code: string) => {
  const fd = new FormData();
  fd.set("code", code);
  return fd;
};
const user = () => db.select().from(schema.users).where(eq(schema.users.id, "totp-user")).get()!;

describe("two-factor sign-in", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(59_000);
    db.insert(schema.users)
      .values({ id: "totp-user", email: "totp@x.test", name: "Two Factor", passwordHash: "", totpSecret: SECRET, totpRecovery: [hashRecovery(RECOVERY)] })
      .run();
  });
  afterAll(() => vi.useRealTimers());

  it("refuses a wrong code", async () => {
    const result = await verifyTotpAction(undefined, form("000000"));
    expect(result?.error).toMatch(/not right/i);
    expect(completed).toHaveLength(0);
  });

  it("accepts the code from the app", async () => {
    await expect(verifyTotpAction(undefined, form("287082"))).rejects.toThrow("REDIRECT:/");
    expect(completed).toContain("pending-session");
    expect(user().totpLastStep).toBe(1);
  });

  it("will not accept the same code twice", async () => {
    const again = await verifyTotpAction(undefined, form("287082"));
    expect(again?.error).toMatch(/already been used/i);
  });

  it("takes a recovery code once, then never again", async () => {
    await expect(verifyTotpAction(undefined, form(RECOVERY.toUpperCase()))).rejects.toThrow("REDIRECT:/");
    expect(user().totpRecovery).toEqual([]);
    const again = await verifyTotpAction(undefined, form(RECOVERY));
    expect(again?.error).toMatch(/not right/i);
  });

  it("says so when the pending sign-in has gone", async () => {
    pendingUserId = null;
    const result = await verifyTotpAction(undefined, form("287082"));
    expect(result?.error).toMatch(/timed out/i);
    pendingUserId = "totp-user";
  });
});
