"use server";
import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { newId } from "@/lib/ids";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { hasAnyUser } from "@/lib/settings";
import { logAudit } from "@/lib/activity";
import { clearFailures, isThrottled, recordFailure } from "@/lib/auth/throttle";
import { createSampleWorkspace } from "@/lib/seed/sample";

export type FormState = { error?: string } | undefined;

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
  if (!user || user.deactivatedAt || !(await verifyPassword(user.passwordHash, parsed.data.password))) {
    await recordFailure(parsed.data.email);
    return { error: "That email and password do not match." };
  }
  await clearFailures(parsed.data.email);
  logAudit({ actorId: user.id, action: "auth.login", subjectType: "user", subjectId: user.id });
  await createSession(user.id);
  const next = String(form.get("next") || "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
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
  if (!invite || invite.expiresAt < Math.floor(Date.now() / 1000)) return { error: "This invite link is no longer valid. Ask an admin for a new one." };
  const parsed = z.object({ name: z.string().trim().min(1, "Enter your name"), password: z.string().min(8, "Use at least 8 characters") }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const existing = db.select().from(schema.users).where(eq(schema.users.email, invite.email)).get();
  const userId = existing?.id ?? newId();
  if (!existing) {
    db.insert(schema.users)
      .values({ id: userId, email: invite.email, name: parsed.data.name, passwordHash: await hashPassword(parsed.data.password), isAdmin: invite.isAdmin })
      .run();
  }
  if (invite.workspaceId) {
    db.insert(schema.memberships)
      .values({ workspaceId: invite.workspaceId, userId, role: invite.workspaceRole ?? "editor", addedBy: invite.invitedBy })
      .onConflictDoNothing()
      .run();
  }
  db.update(schema.invites).set({ acceptedAt: Math.floor(Date.now() / 1000) }).where(eq(schema.invites.id, invite.id)).run();
  logAudit({ actorId: userId, action: "invite.accepted", subjectType: "invite", subjectId: invite.id });
  await createSession(userId);
  redirect("/");
}
