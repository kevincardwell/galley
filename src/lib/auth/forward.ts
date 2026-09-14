import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { newId } from "@/lib/ids";
import { logAudit } from "@/lib/activity";
import type { User } from "@/db/schema";

/**
 * Signing in through a reverse proxy that has already authenticated the person
 * — Authelia, Authentik, oauth2-proxy, Tailscale — which is how a lot of
 * self-hosters run everything behind one login.
 *
 * THE WHOLE SECURITY MODEL IS THE PROXY. These are ordinary HTTP headers, so
 * anyone who can reach Galley directly can set them and become whoever they
 * like. Two consequences, both deliberate:
 *
 *   - It is off unless GALLEY_AUTH_HEADERS is set, so no existing install
 *     changes behaviour on upgrade.
 *   - Turning it on means Galley must not be reachable except through the
 *     proxy. Bind it to localhost or an internal network. The README says so
 *     next to the setting, because getting this wrong is an open door.
 */

export type ForwardAuthConfig = {
  enabled: boolean;
  /** Header carrying the email address. The only one that is required. */
  emailHeader: string;
  /** Optional display name; the local part of the email is used when it is missing. */
  nameHeader: string;
  /** Create an account the first time someone arrives, rather than requiring an invite first. */
  autoCreate: boolean;
};

const flag = (v: string | undefined) => v === "1" || v?.toLowerCase() === "true";

export function forwardAuthConfig(env: Record<string, string | undefined> = process.env): ForwardAuthConfig {
  return {
    enabled: flag(env.GALLEY_AUTH_HEADERS),
    emailHeader: (env.GALLEY_AUTH_EMAIL_HEADER || "Remote-Email").toLowerCase(),
    nameHeader: (env.GALLEY_AUTH_NAME_HEADER || "Remote-Name").toLowerCase(),
    // Default off: Galley is invite-only, and an operator who wants the proxy to
    // be the gate should say so rather than discover it.
    autoCreate: flag(env.GALLEY_AUTH_AUTO_CREATE),
  };
}

/** Nothing clever: an address the proxy could plausibly have authenticated. */
function cleanEmail(raw: string | null): string | null {
  const email = (raw ?? "").trim().toLowerCase();
  if (!email || email.length > 200) return null;
  return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email) ? email : null;
}

export type ForwardAuthResult =
  | { ok: true; user: User; created: boolean }
  | { ok: false; reason: "disabled" | "no-header" | "unknown-user" | "deactivated" };

/**
 * Resolves the user a proxy says is calling. Does not create a session: the
 * caller does that, so this stays testable without a request context.
 */
export function resolveForwardAuth(headers: Headers, config = forwardAuthConfig()): ForwardAuthResult {
  if (!config.enabled) return { ok: false, reason: "disabled" };

  const email = cleanEmail(headers.get(config.emailHeader));
  if (!email) return { ok: false, reason: "no-header" };

  const existing = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
  if (existing) {
    // A deactivated account stays deactivated whatever the proxy says.
    if (existing.deactivatedAt) return { ok: false, reason: "deactivated" };
    return { ok: true, user: existing, created: false };
  }

  if (!config.autoCreate) return { ok: false, reason: "unknown-user" };

  const name = (headers.get(config.nameHeader) ?? "").trim().slice(0, 80) || email.split("@")[0];
  // First person through the door runs the place, the same rule as the setup screen.
  const isAdmin = !db.select({ id: schema.users.id }).from(schema.users).limit(1).get();
  const user: User = {
    id: newId(),
    email,
    name,
    // No password is ever usable: this account signs in through the proxy only.
    passwordHash: "",
    isAdmin,
    deactivatedAt: null,
    lastSeenAt: null,
    createdAt: Math.floor(Date.now() / 1000),
  };
  db.insert(schema.users).values(user).run();
  logAudit({ actorId: user.id, action: "user.created_by_proxy", subjectType: "user", subjectId: user.id, meta: { email, isAdmin } });
  return { ok: true, user, created: true };
}
