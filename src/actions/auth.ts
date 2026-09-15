"use server";
import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { inviteExpired } from "@/db/schema";
import { newId } from "@/lib/ids";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { completePendingSession, createSession, destroySession, getPendingSession } from "@/lib/auth/session";
import { currentUser } from "@/lib/auth/current";
import { hasAnyUser } from "@/lib/settings";
import { logAudit } from "@/lib/activity";
import { clearFailures, isThrottled, recordFailure } from "@/lib/auth/throttle";
import { createSampleWorkspace } from "@/lib/seed/sample";
import { hashRecovery, verifyCode } from "@/lib/auth/totp";

export type FormState = { error?: string } | undefined;

/** A real argon2id hash of a value nobody can guess, used to keep failed logins constant-time. */
const DUMMY_HASH = "$argon2id$v=19$m=19456,t=2,p=1$Z2FsbGV5LWR1bW15LXNhbHQ$0hVZ1i0nQ0Vv0y1Qn5b2Zr8Yx9kZJj1kq0m3kQ8k1zY";

/** Marks an invite used. Separate so both redemption paths record it the same way. */
function acceptInvite(id: string) {
  db.update(schema.invites).set({ acceptedAt: Math.floor(Date.now() / 1000) }).where(eq(schema.invites.id, id)).run();
}

const credentials = z.object({ email: z.string().email().toLowerCase(), password: z.string().min(8, "Use at least 8 characters") });

export async function setupAction(_: FormState, form: FormData): Promise<FormState> {
  if (hasAnyUser()) redirect("/login");
  const parsed = credentials.extend({ name: z.string().trim().min(1, "Enter your name") }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { name, email, password } = parsed.data;
  const id = newId();
  db.insert(schema.users).values({ id, name, email, passwordHash: await hashPassword(password), isAdmin: true }).run();
  logAudit({ actorId: id, action: "setup.admin_created", subjectType: "user", subjectId: id });
  let next = "/";
  if (form.get("sample") === "on") {
    // A failed sample must never block the admin from getting in.
    try {
      const { slug } = await createSampleWorkspace(id);
      logAudit({ actorId: id, action: "setup.sample_created", subjectType: "workspace", subjectId: slug });
      next = `/w/${slug}`;
    } catch (err) {
      console.error("[setup] sample workspace failed", err);
    }
  }
  await createSession(id);
  redirect(next);
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = credentials.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Check your email and password." };
  if (await isThrottled(parsed.data.email)) return { error: "Too many attempts. Try again in a few minutes." };
  const user = db.select().from(schema.users).where(eq(schema.users.email, parsed.data.email)).get();
  // Always spend the same argon2 time, so an unknown address cannot be told apart by how fast we answer.
  const ok = user && !user.deactivatedAt
    ? await verifyPassword(user.passwordHash, parsed.data.password)
    : await verifyPassword(DUMMY_HASH, parsed.data.password);
  if (!user || user.deactivatedAt || !ok) {
    await recordFailure(parsed.data.email);
    return { error: "That email and password do not match." };
  }
  await clearFailures(parsed.data.email);
  const next = safeNext(String(form.get("next") || ""));

  // Two-factor on: the password alone signs nobody in. The session exists but stays
  // pending — it is a short-lived "this browser got the password right" note, nothing more.
  if (user.totpSecret) {
    await createSession(user.id, { pendingTotp: true });
    redirect(`/login/2fa${next === "/" ? "" : `?next=${encodeURIComponent(next)}`}`);
  }

  logAudit({ actorId: user.id, action: "auth.login", subjectType: "user", subjectId: user.id });
  await createSession(user.id);
  redirect(next);
}

/** Only ever bounce to a path inside this app. */
function safeNext(raw: string): string {
  return /^\/(?![/\\])/.test(raw) ? raw : "/";
}

/**
 * Second step of a two-factor sign-in: a six-digit code, or one recovery code.
 * Both are checked against the pending session, so the password step cannot be skipped.
 */
export async function verifyTotpAction(_: FormState, form: FormData): Promise<FormState> {
  const pending = await getPendingSession();
  const user = pending?.user;
  const secret = user?.totpSecret;
  if (!pending || !user || !secret) return { error: "That sign-in has timed out. Start again." };
  if (await isThrottled(user.email)) return { error: "Too many attempts. Try again in a few minutes." };

  const typed = String(form.get("code") || "");
  const step = verifyCode(secret, typed);
  if (step !== null) {
    // A code is good for its 30-second step only once: someone watching the screen cannot reuse it.
    if (user.totpLastStep !== null && step <= user.totpLastStep) {
      await recordFailure(user.email);
      return { error: "That code has already been used. Wait for the next one." };
    }
    db.update(schema.users).set({ totpLastStep: step }).where(eq(schema.users.id, user.id)).run();
  } else if (!consumeRecoveryCode(user.id, user.totpRecovery, typed)) {
    await recordFailure(user.email);
    return { error: "That code is not right. Check the clock on your phone, or use a recovery code." };
  }

  await clearFailures(user.email);
  await completePendingSession(pending.id);
  logAudit({ actorId: user.id, action: "auth.login", subjectType: "user", subjectId: user.id, meta: { totp: step !== null ? "code" : "recovery" } });
  redirect(safeNext(String(form.get("next") || "")));
}

/** Spends one recovery code. Each works once, so it is removed as it is accepted. */
function consumeRecoveryCode(userId: string, codes: string[] | null, typed: string): boolean {
  const cleaned = typed.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!codes?.length || cleaned.length < 8) return false;
  const hash = hashRecovery(cleaned);
  const left = codes.filter((c) => c !== hash);
  if (left.length === codes.length) return false;
  db.update(schema.users).set({ totpRecovery: left }).where(eq(schema.users.id, userId)).run();
  return true;
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function acceptInviteAction(_: FormState, form: FormData): Promise<FormState> {
  const token = String(form.get("token") || "");
  const invite = db
    .select()
    .from(schema.invites)
    .where(and(eq(schema.invites.token, token), isNull(schema.invites.acceptedAt), isNull(schema.invites.revokedAt)))
    .get();
  if (!invite || inviteExpired(invite.expiresAt)) return { error: "This invite link is no longer valid. Ask an admin for a new one." };
  const parsed = z.object({ name: z.string().trim().min(1, "Enter your name"), password: z.string().min(8, "Use at least 8 characters") }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const existing = db.select().from(schema.users).where(eq(schema.users.email, invite.email)).get();

  // An invite must never be a way into an account that already exists: the password typed here
  // is not that account's password. Only the signed-in owner of the address may redeem it.
  if (existing) {
    const signedIn = await currentUser();
    if (signedIn?.id !== existing.id) {
      return { error: "That email already has an account. Sign in first, then open this link again." };
    }
    if (invite.workspaceId) {
      db.insert(schema.memberships)
        .values({ workspaceId: invite.workspaceId, userId: existing.id, role: invite.workspaceRole ?? "editor", addedBy: invite.invitedBy })
        .onConflictDoNothing()
        .run();
    }
    acceptInvite(invite.id);
    logAudit({ actorId: existing.id, action: "invite.accepted", subjectType: "invite", subjectId: invite.id });
    redirect("/");
  }

  const userId = newId();
  const passwordHash = await hashPassword(parsed.data.password);
  // One transaction, and the accept is conditional, so two simultaneous redemptions cannot both win.
  const claimed = db.transaction((tx) => {
    const res = tx
      .update(schema.invites)
      .set({ acceptedAt: Math.floor(Date.now() / 1000) })
      .where(and(eq(schema.invites.id, invite.id), isNull(schema.invites.acceptedAt), isNull(schema.invites.revokedAt)))
      .run();
    if (res.changes === 0) return false;
    tx.insert(schema.users)
      .values({ id: userId, email: invite.email, name: parsed.data.name, passwordHash, isAdmin: invite.isAdmin })
      .run();
    if (invite.workspaceId) {
      tx.insert(schema.memberships)
        .values({ workspaceId: invite.workspaceId, userId, role: invite.workspaceRole ?? "editor", addedBy: invite.invitedBy })
        .onConflictDoNothing()
        .run();
    }
    return true;
  });
  if (!claimed) return { error: "This invite link has already been used. Ask an admin for a new one." };

  logAudit({ actorId: userId, action: "invite.accepted", subjectType: "invite", subjectId: invite.id });
  await createSession(userId);
  redirect("/");
}
