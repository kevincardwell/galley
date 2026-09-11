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
