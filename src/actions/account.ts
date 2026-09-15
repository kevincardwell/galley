"use server";
import { and, eq, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { requireUser } from "@/lib/auth/current";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { logAudit } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { grouped, hashRecovery, newRecoveryCodes, newSecret, otpauthUrl, qrPath, verifyCode } from "@/lib/auth/totp";
import type { User } from "@/db/schema";

export type AccountResult = { ok: true } | { ok: false; error: string };

export async function updateProfile(name: string): Promise<AccountResult> {
  const user = await requireUser();
  const parsed = z.string().trim().min(1, "Enter your name").max(80, "Keep your name under 80 characters").safeParse(name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter your name" };
  if (parsed.data === user.name) return { ok: true };
  db.update(schema.users).set({ name: parsed.data }).where(eq(schema.users.id, user.id)).run();
  logAudit({ actorId: user.id, action: "user.profile.updated", subjectType: "user", subjectId: user.id, meta: { from: user.name, to: parsed.data } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function changePassword(current: string, next: string): Promise<AccountResult> {
  const user = await requireUser();
  if (typeof current !== "string" || !current) return { ok: false, error: "Enter your current password." };
  const parsed = z.string().min(8, "Use at least 8 characters").max(200, "That password is too long").safeParse(next);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Use at least 8 characters" };
  if (!(await verifyPassword(user.passwordHash, current))) return { ok: false, error: "Your current password is not right." };
  if (current === parsed.data) return { ok: false, error: "Choose a password you have not used here before." };

  const passwordHash = await hashPassword(parsed.data);
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value ?? "";
  db.transaction((tx) => {
    tx.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, user.id)).run();
    // Sign out everywhere else; keep the session that made this change.
    tx.delete(schema.sessions).where(and(eq(schema.sessions.userId, user.id), ne(schema.sessions.id, sessionId))).run();
  });
  logAudit({ actorId: user.id, action: "user.password.changed", subjectType: "user", subjectId: user.id });
  return { ok: true };
}

// ---- Two-factor ----

export type TotpSetup = { secret: string; otpauth: string; grouped: string; qr: { size: number; d: string } };
export type TotpResult = { ok: true; codes: string[] } | { ok: false; error: string };

/** A password check before changing how sign-in works. Proxy-only accounts have no password to check. */
async function confirmPassword(user: User, password: string): Promise<string | null> {
  if (!user.passwordHash) return null;
  return (await verifyPassword(user.passwordHash, password)) ? null : "Your password is not right.";
}

/**
 * Makes a secret to show as a QR. Nothing is stored until a code proves the app has it,
 * so an abandoned setup leaves the account exactly as it was.
 */
export async function startTotp(): Promise<TotpSetup> {
  const user = await requireUser();
  const secret = newSecret();
  const otpauth = otpauthUrl(secret, user.email, getSettings().instanceName || "Galley");
  return { secret, otpauth, grouped: grouped(secret), qr: qrPath(otpauth) };
}

export async function enableTotp(secret: string, code: string, password: string): Promise<TotpResult> {
  const user = await requireUser();
  if (user.totpSecret) return { ok: false, error: "Two-factor is already on for this account." };
  const wrong = await confirmPassword(user, password);
  if (wrong) return { ok: false, error: wrong };
  if (!/^[A-Z2-7]{32}$/.test(secret)) return { ok: false, error: "Start the setup again." };
  const step = verifyCode(secret, code);
  if (step === null) return { ok: false, error: "That code is not right. Check the clock on your phone and try the next one." };

  const codes = newRecoveryCodes();
  db.update(schema.users)
    .set({ totpSecret: secret, totpLastStep: step, totpRecovery: codes.map(hashRecovery) })
    .where(eq(schema.users.id, user.id))
    .run();
  logAudit({ actorId: user.id, action: "user.totp.enabled", subjectType: "user", subjectId: user.id });
  revalidatePath("/me/account");
  return { ok: true, codes };
}

export async function disableTotp(password: string): Promise<AccountResult> {
  const user = await requireUser();
  const wrong = await confirmPassword(user, password);
  if (wrong) return { ok: false, error: wrong };
  db.update(schema.users).set({ totpSecret: null, totpLastStep: null, totpRecovery: null }).where(eq(schema.users.id, user.id)).run();
  logAudit({ actorId: user.id, action: "user.totp.disabled", subjectType: "user", subjectId: user.id });
  revalidatePath("/me/account");
  return { ok: true };
}
