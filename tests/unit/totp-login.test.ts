import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NOT_FOUND"); },
  redirect: (to: string) => { throw new Error(`REDIRECT:${to}`); },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth/current", () => ({ currentUser: async () => null, requireUser: async () => { throw new Error("no user"); } }));
// The throttle reads request headers, which there are none of here. `blocked` parks a request
// between reading the pending session and spending the code — the window a second request can
// slip into, and the window every race below is about.
const throttle = vi.hoisted(() => {
  const state = { blocked: false, waiting: [] as (() => void)[] };
  const park = async () => {
    if (state.blocked) await new Promise<void>((resolve) => state.waiting.push(resolve));
  };
  const release = () => {
    state.blocked = false;
    state.waiting.splice(0).forEach((resolve) => resolve());
  };
  return { state, park, release, totpFailures: { count: 0 } };
});
vi.mock("@/lib/auth/throttle", () => ({
  isThrottled: async () => { await throttle.park(); return false; },
  recordFailure: async () => {},
  clearFailures: async () => {},
  isTotpThrottled: async () => { await throttle.park(); return false; },
  recordTotpFailure: async () => { throttle.totpFailures.count += 1; },
  clearTotpFailures: async () => {},
}));

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
    const failures = throttle.totpFailures.count;
    const result = await verifyTotpAction(undefined, form("000000"));
    expect(result?.error).toMatch(/not right/i);
    expect(completed).toHaveLength(0);
    expect(throttle.totpFailures.count).toBe(failures + 1);
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

  it("spends a code for exactly one of two simultaneous requests", async () => {
    db.insert(schema.users).values({ id: "totp-race", email: "race@x.test", name: "Race", passwordHash: "", totpSecret: SECRET }).run();
    pendingUserId = "totp-race";
    throttle.state.blocked = true;
    const first = verifyTotpAction(undefined, form("287082"));
    const second = verifyTotpAction(undefined, form("287082"));
    await settleAtGate(2);
    throttle.release();

    const results = await Promise.allSettled([first, second]);
    // The winner redirects; the loser is refused, not silently let in with a stale read.
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    const refused = results.filter((r) => r.status === "fulfilled" && (r.value as { error?: string })?.error?.match(/already been used/i));
    expect(refused).toHaveLength(1);
    expect(db.select({ step: schema.users.totpLastStep }).from(schema.users).where(eq(schema.users.id, "totp-race")).get()?.step).toBe(1);
    pendingUserId = "totp-user";
  });

  it("spends a recovery code for exactly one of two simultaneous requests", async () => {
    const OTHER = "pqrs-tuvw-xyz2";
    db.insert(schema.users)
      .values({ id: "totp-rec-race", email: "rec-race@x.test", name: "Rec", passwordHash: "", totpSecret: SECRET, totpRecovery: [hashRecovery(RECOVERY), hashRecovery(OTHER)] })
      .run();
    pendingUserId = "totp-rec-race";
    throttle.state.blocked = true;
    const first = verifyTotpAction(undefined, form(RECOVERY));
    const second = verifyTotpAction(undefined, form(RECOVERY));
    await settleAtGate(2);
    throttle.release();

    const results = await Promise.allSettled([first, second]);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    // The spent code is gone, and the loser's write must not resurrect it over the winner's.
    const left = db.select({ codes: schema.users.totpRecovery }).from(schema.users).where(eq(schema.users.id, "totp-rec-race")).get()?.codes;
    expect(left).toEqual([hashRecovery(OTHER)]);
    pendingUserId = "totp-user";
  });
});

/** Flushes microtasks until `expected` requests are parked on the throttle gate. */
async function settleAtGate(expected: number) {
  for (let i = 0; i < 500 && throttle.state.waiting.length < expected; i++) await Promise.resolve();
  expect(throttle.state.waiting).toHaveLength(expected);
}
