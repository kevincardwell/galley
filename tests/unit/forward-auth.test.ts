import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (u: string) => { throw new Error("REDIRECT:" + u); } }));

import { db, schema } from "@/db/client";
import { forwardAuthConfig, resolveForwardAuth } from "@/lib/auth/forward";

const on = { enabled: true, emailHeader: "remote-email", nameHeader: "remote-name", autoCreate: false, secret: "" };
const onCreating = { ...on, autoCreate: true };
const vouched = { ...onCreating, secret: "proxy-secret" };
const seedUser = () => db.insert(schema.users).values({ id: "fa-seed", email: "seed@x.test", name: "Seed", passwordHash: "" }).run();

const h = (init: Record<string, string>) => new Headers(init);
const users = () => db.select().from(schema.users).all();
const byEmail = (email: string) => db.select().from(schema.users).where(eq(schema.users.email, email)).get();

describe("reading the configuration", () => {
  it("is off unless it is explicitly switched on", () => {
    expect(forwardAuthConfig({}).enabled).toBe(false);
    expect(forwardAuthConfig({ GALLEY_AUTH_HEADERS: "0" }).enabled).toBe(false);
    expect(forwardAuthConfig({ GALLEY_AUTH_HEADERS: "" }).enabled).toBe(false);
    expect(forwardAuthConfig({ GALLEY_AUTH_HEADERS: "1" }).enabled).toBe(true);
    expect(forwardAuthConfig({ GALLEY_AUTH_HEADERS: "true" }).enabled).toBe(true);
  });

  it("defaults to Authelia's header names and lets them be changed", () => {
    expect(forwardAuthConfig({}).emailHeader).toBe("remote-email");
    // Authentik and oauth2-proxy use their own; header lookup is case-insensitive.
    expect(forwardAuthConfig({ GALLEY_AUTH_EMAIL_HEADER: "X-Authentik-Email" }).emailHeader).toBe("x-authentik-email");
  });

  it("does not create accounts unless asked", () => {
    expect(forwardAuthConfig({ GALLEY_AUTH_HEADERS: "1" }).autoCreate).toBe(false);
  });

  it("reads the shared secret, trimmed", () => {
    expect(forwardAuthConfig({ GALLEY_AUTH_HEADERS: "1" }).secret).toBe("");
    expect(forwardAuthConfig({ GALLEY_AUTH_HEADERS: "1", GALLEY_AUTH_SECRET: "  hunter2  " }).secret).toBe("hunter2");
  });
});

describe("resolving who the proxy says is calling", () => {
  beforeEach(() => {
    db.delete(schema.users).run();
  });

  it("refuses everything while it is switched off", () => {
    db.insert(schema.users).values({ id: "fa-1", email: "kev@x.test", name: "Kev", passwordHash: "" }).run();
    const res = resolveForwardAuth(h({ "remote-email": "kev@x.test" }), { ...on, enabled: false });
    expect(res).toEqual({ ok: false, reason: "disabled" });
  });

  it("matches an existing account by email", () => {
    db.insert(schema.users).values({ id: "fa-1", email: "kev@x.test", name: "Kev", passwordHash: "" }).run();
    const res = resolveForwardAuth(h({ "remote-email": " KEV@X.test " }), on);
    expect(res.ok && res.user.id).toBe("fa-1");
    expect(res.ok && res.created).toBe(false);
  });

  it("refuses an address that has never been invited, by default", () => {
    const res = resolveForwardAuth(h({ "remote-email": "stranger@x.test" }), on);
    expect(res).toEqual({ ok: false, reason: "unknown-user" });
    expect(users()).toHaveLength(0);
  });

  /** The proxy may say what it likes; a switched-off account stays switched off. */
  it("refuses a deactivated account even with a valid header", () => {
    db.insert(schema.users).values({ id: "fa-2", email: "gone@x.test", name: "Gone", passwordHash: "", deactivatedAt: 1 }).run();
    const res = resolveForwardAuth(h({ "remote-email": "gone@x.test" }), onCreating);
    expect(res).toEqual({ ok: false, reason: "deactivated" });
  });

  it("refuses a missing or malformed address rather than guessing", () => {
    expect(resolveForwardAuth(h({}), onCreating)).toEqual({ ok: false, reason: "no-header" });
    expect(resolveForwardAuth(h({ "remote-email": "not-an-email" }), onCreating)).toEqual({ ok: false, reason: "no-header" });
    expect(resolveForwardAuth(h({ "remote-email": "  " }), onCreating)).toEqual({ ok: false, reason: "no-header" });
    expect(users()).toHaveLength(0);
  });

  it("creates an account when asked to, taking the display name from the proxy", () => {
    db.insert(schema.users).values({ id: "fa-existing", email: "someone@x.test", name: "Someone", passwordHash: "" }).run();
    const res = resolveForwardAuth(h({ "remote-email": "new@x.test", "remote-name": "New Person" }), onCreating);
    expect(res.ok && res.created).toBe(true);
    const created = byEmail("new@x.test")!;
    expect(created.name).toBe("New Person");
    // Not the first user, so not an admin.
    expect(created.isAdmin).toBe(false);
    // No password is ever usable on a proxy-created account.
    expect(created.passwordHash).toBe("");
  });

  it("falls back to the local part when the proxy sends no name", () => {
    seedUser();
    resolveForwardAuth(h({ "remote-email": "holly@x.test" }), onCreating);
    expect(byEmail("holly@x.test")!.name).toBe("holly");
  });

  it("makes the very first person through the door an admin when the proxy is vouched for", () => {
    const res = resolveForwardAuth(h({ "remote-email": "first@x.test", "x-galley-auth": "proxy-secret" }), vouched);
    expect(res.ok && res.user.isAdmin).toBe(true);
    // And the second is not.
    resolveForwardAuth(h({ "remote-email": "second@x.test", "x-galley-auth": "proxy-secret" }), vouched);
    expect(byEmail("second@x.test")!.isAdmin).toBe(false);
  });

  it("refuses to create the first account without a secret to vouch for the proxy", () => {
    // The first account is the admin, and headers are only words anyone can type.
    const res = resolveForwardAuth(h({ "remote-email": "claimant@x.test" }), onCreating);
    expect(res).toEqual({ ok: false, reason: "setup-required" });
    expect(users()).toHaveLength(0);
  });

  it("requires the configured secret on every request", () => {
    seedUser();
    expect(resolveForwardAuth(h({ "remote-email": "kev@x.test" }), vouched)).toEqual({ ok: false, reason: "bad-secret" });
    expect(resolveForwardAuth(h({ "remote-email": "kev@x.test", "x-galley-auth": "wrong" }), vouched)).toEqual({ ok: false, reason: "bad-secret" });
    expect(resolveForwardAuth(h({ "remote-email": "kev@x.test", "x-galley-auth": "proxy-secret-x" }), vouched)).toEqual({ ok: false, reason: "bad-secret" });
    expect(resolveForwardAuth(h({ "remote-email": "kev@x.test", "x-galley-auth": "proxy-secret" }), vouched).ok).toBe(true);
  });

  it("signs the same person in again without making a second account", () => {
    seedUser();
    resolveForwardAuth(h({ "remote-email": "repeat@x.test" }), onCreating);
    resolveForwardAuth(h({ "remote-email": "repeat@x.test" }), onCreating);
    expect(users().filter((u) => u.email === "repeat@x.test")).toHaveLength(1);
  });
});
