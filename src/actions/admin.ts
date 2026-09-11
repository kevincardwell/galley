"use server";
import fsp from "node:fs/promises";
import path from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema, UPLOAD_DIR } from "@/db/client";
import { WORKSPACE_ROLES, type WorkspaceRole } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/current";
import { hashPassword } from "@/lib/auth/password";
import { logAudit } from "@/lib/activity";
import { newId, newToken } from "@/lib/ids";
import { getSettings, saveSettings, type BackupSettings, type InstanceSettings } from "@/lib/settings";
import { storage } from "@/lib/storage";
import { resolveBaseUrl } from "@/lib/queries/admin";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { inviteEmail, testEmail } from "@/lib/email/templates";
import { createBackup, deleteBackup, pruneBackups, type BackupRow } from "@/lib/backup";

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const fail = <T,>(error: string): Result<T> => ({ ok: false, error });
const nowS = () => Math.floor(Date.now() / 1000);
const INVITE_DAYS = 7;

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
}

function firstIssue(e: z.ZodError): string {
  return e.issues[0]?.message ?? "Check the form";
}

const email = z.string().trim().toLowerCase().email("Enter a valid email address");
const password = z.string().min(8, "Use at least 8 characters");
const role = z.enum(WORKSPACE_ROLES);

// ---- Invites ----

const inviteInput = z.object({
  email,
  name: z.string().trim().max(80).optional(),
  workspaceId: z.string().trim().optional(),
  workspaceRole: role.optional(),
  isAdmin: z.boolean().optional(),
});
export type CreateInviteInput = z.input<typeof inviteInput>;

export async function createInvite(input: CreateInviteInput): Promise<Result<{ url: string; inviteId: string; emailed: boolean }>> {
  const admin = await requireAdmin();
  const parsed = inviteInput.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { name, workspaceId, workspaceRole, isAdmin } = parsed.data;
  const existing = db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, parsed.data.email)).get();
  if (existing) return fail("Someone with that email already has an account. Add them to a workspace from Manage instead.");
  let workspaceName: string | null = null;
  if (workspaceId) {
    const ws = db.select({ name: schema.workspaces.name }).from(schema.workspaces).where(eq(schema.workspaces.id, workspaceId)).get();
    if (!ws) return fail("That workspace no longer exists.");
    workspaceName = ws.name;
  }
  const id = newId();
  const token = newToken();
  db.insert(schema.invites)
    .values({
      id,
      token,
      email: parsed.data.email,
      name: name || null,
      isAdmin: isAdmin ?? false,
      workspaceId: workspaceId || null,
      workspaceRole: workspaceId ? (workspaceRole ?? "editor") : null,
      invitedBy: admin.id,
      expiresAt: nowS() + INVITE_DAYS * 86400,
    })
    .run();
  const url = `${await resolveBaseUrl()}/invite/${token}`;
  let emailed = false;
  if (isEmailConfigured()) {
    const mail = inviteEmail({ instanceName: getSettings().instanceName, url, inviterName: admin.name, workspaceName, expiresDays: INVITE_DAYS });
    emailed = (await sendEmail({ to: parsed.data.email, ...mail })).ok;
  }
  logAudit({ actorId: admin.id, action: "invite.created", subjectType: "invite", subjectId: id, meta: { email: parsed.data.email, workspaceId: workspaceId || null, isAdmin: isAdmin ?? false, emailed } });
  refresh();
  return ok({ url, inviteId: id, emailed });
}

export async function revokeInvite(inviteId: string): Promise<Result> {
  const admin = await requireAdmin();
  const invite = db.select().from(schema.invites).where(eq(schema.invites.id, inviteId)).get();
  if (!invite) return fail("That invite no longer exists.");
  if (invite.acceptedAt) return fail("That invite was already accepted.");
  db.update(schema.invites).set({ revokedAt: nowS() }).where(eq(schema.invites.id, inviteId)).run();
  logAudit({ actorId: admin.id, action: "invite.revoked", subjectType: "invite", subjectId: inviteId, meta: { email: invite.email } });
  refresh();
  return ok(undefined);
}

// ---- Users ----

const userInput = z.object({ name: z.string().trim().min(1, "Enter their name").max(80), email, password, isAdmin: z.boolean().optional() });
export type CreateUserInput = z.input<typeof userInput>;

export async function createUser(input: CreateUserInput): Promise<Result<{ userId: string }>> {
  const admin = await requireAdmin();
  const parsed = userInput.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const existing = db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, parsed.data.email)).get();
  if (existing) return fail("Someone with that email already has an account.");
  const id = newId();
  db.insert(schema.users)
    .values({ id, name: parsed.data.name, email: parsed.data.email, passwordHash: await hashPassword(parsed.data.password), isAdmin: parsed.data.isAdmin ?? false })
    .run();
  logAudit({ actorId: admin.id, action: "user.created", subjectType: "user", subjectId: id, meta: { email: parsed.data.email, isAdmin: parsed.data.isAdmin ?? false } });
  refresh();
  return ok({ userId: id });
}

function findUser(userId: string) {
  return db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
}

export async function setUserAdmin(userId: string, isAdmin: boolean): Promise<Result> {
  const admin = await requireAdmin();
  if (userId === admin.id && !isAdmin) return fail("You cannot remove your own admin role.");
  const target = findUser(userId);
  if (!target) return fail("That person no longer exists.");
  db.update(schema.users).set({ isAdmin }).where(eq(schema.users.id, userId)).run();
  logAudit({ actorId: admin.id, action: isAdmin ? "user.admin_granted" : "user.admin_removed", subjectType: "user", subjectId: userId, meta: { email: target.email } });
  refresh();
  return ok(undefined);
}

export async function deactivateUser(userId: string): Promise<Result> {
  const admin = await requireAdmin();
  if (userId === admin.id) return fail("You cannot deactivate yourself.");
  const target = findUser(userId);
  if (!target) return fail("That person no longer exists.");
  db.transaction((tx) => {
    tx.update(schema.users).set({ deactivatedAt: nowS() }).where(eq(schema.users.id, userId)).run();
    tx.delete(schema.sessions).where(eq(schema.sessions.userId, userId)).run();
  });
  logAudit({ actorId: admin.id, action: "user.deactivated", subjectType: "user", subjectId: userId, meta: { email: target.email } });
  refresh();
  return ok(undefined);
}

export async function reactivateUser(userId: string): Promise<Result> {
  const admin = await requireAdmin();
  const target = findUser(userId);
  if (!target) return fail("That person no longer exists.");
  db.update(schema.users).set({ deactivatedAt: null }).where(eq(schema.users.id, userId)).run();
  logAudit({ actorId: admin.id, action: "user.reactivated", subjectType: "user", subjectId: userId, meta: { email: target.email } });
  refresh();
  return ok(undefined);
}

export async function resetPassword(userId: string, newPassword: string): Promise<Result> {
  const admin = await requireAdmin();
  const parsed = password.safeParse(newPassword);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const target = findUser(userId);
  if (!target) return fail("That person no longer exists.");
  const passwordHash = await hashPassword(parsed.data);
  db.transaction((tx) => {
    tx.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, userId)).run();
    tx.delete(schema.sessions).where(eq(schema.sessions.userId, userId)).run();
  });
  logAudit({ actorId: admin.id, action: "user.password_reset", subjectType: "user", subjectId: userId, meta: { email: target.email } });
  return ok(undefined);
}

export async function deleteUser(userId: string): Promise<Result> {
  const admin = await requireAdmin();
  if (userId === admin.id) return fail("You cannot delete yourself.");
  const target = findUser(userId);
  if (!target) return fail("That person no longer exists.");
  db.transaction((tx) => {
    // invites.invited_by has no ON DELETE clause; hand their invites to the acting admin so the delete can go through.
    tx.update(schema.invites).set({ invitedBy: admin.id }).where(eq(schema.invites.invitedBy, userId)).run();
    tx.delete(schema.users).where(eq(schema.users.id, userId)).run();
  });
  logAudit({ actorId: admin.id, action: "user.deleted", subjectType: "user", subjectId: userId, meta: { email: target.email, name: target.name } });
  refresh();
  return ok(undefined);
}

// ---- Memberships ----

export async function setMembership(workspaceId: string, userId: string, roleValue: WorkspaceRole): Promise<Result> {
  const admin = await requireAdmin();
  const parsedRole = role.safeParse(roleValue);
  if (!parsedRole.success) return fail("Unknown role");
  const ws = db.select({ id: schema.workspaces.id }).from(schema.workspaces).where(eq(schema.workspaces.id, workspaceId)).get();
  const target = findUser(userId);
  if (!ws || !target) return fail("Not found");
  db.insert(schema.memberships)
    .values({ workspaceId, userId, role: parsedRole.data, addedBy: admin.id })
    .onConflictDoUpdate({ target: [schema.memberships.workspaceId, schema.memberships.userId], set: { role: parsedRole.data } })
    .run();
  logAudit({ actorId: admin.id, action: "member.set", subjectType: "workspace", subjectId: workspaceId, meta: { userId, role: parsedRole.data } });
  refresh();
  return ok(undefined);
}

export async function removeMembership(workspaceId: string, userId: string): Promise<Result> {
  const admin = await requireAdmin();
  db.delete(schema.memberships).where(and(eq(schema.memberships.workspaceId, workspaceId), eq(schema.memberships.userId, userId))).run();
  logAudit({ actorId: admin.id, action: "member.removed", subjectType: "workspace", subjectId: workspaceId, meta: { userId } });
  refresh();
  return ok(undefined);
}

// ---- Workspaces ----

function findWorkspace(workspaceId: string) {
  return db.select().from(schema.workspaces).where(eq(schema.workspaces.id, workspaceId)).get();
}

export async function archiveWorkspace(workspaceId: string, archived: boolean): Promise<Result> {
  const admin = await requireAdmin();
  const ws = findWorkspace(workspaceId);
  if (!ws) return fail("That workspace no longer exists.");
  db.update(schema.workspaces)
    .set(archived ? { status: "archived", archivedAt: nowS() } : { status: "live", archivedAt: null })
    .where(eq(schema.workspaces.id, workspaceId))
    .run();
  logAudit({ actorId: admin.id, action: archived ? "workspace.archived" : "workspace.restored", subjectType: "workspace", subjectId: workspaceId, meta: { name: ws.name } });
  refresh();
  return ok(undefined);
}

export async function deleteWorkspace(workspaceId: string): Promise<Result> {
  const admin = await requireAdmin();
  const ws = findWorkspace(workspaceId);
  if (!ws) return fail("That workspace no longer exists.");
  db.delete(schema.workspaces).where(eq(schema.workspaces.id, workspaceId)).run();
  await storage.removeWorkspace(workspaceId);
  logAudit({ actorId: admin.id, action: "workspace.deleted", subjectType: "workspace", subjectId: workspaceId, meta: { name: ws.name } });
  refresh();
  return ok(undefined);
}

// ---- Settings ----

const settingsInput = z.object({
  instanceName: z.string().trim().min(1, "Give the instance a name").max(80),
  baseUrl: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || /^https?:\/\/[^\s/]+/.test(v), "Base URL must start with http:// or https://")
    .transform((v) => v.replace(/\/+$/, "")),
  maxUploadMb: z.coerce.number().int("Whole megabytes only").min(1, "At least 1 MB").max(100000, "That is more than 100 GB"),
  sessionDays: z.coerce.number().int("Whole days only").min(1, "At least 1 day").max(365, "At most a year"),
  smtp: z
    .object({
      host: z.string().trim().max(200),
      port: z.coerce.number().int().min(1).max(65535),
      user: z.string().trim().max(200),
      pass: z.string().max(200),
      from: z.string().trim().max(200),
    })
    .nullable()
    .optional(),
});
export type SaveSettingsInput = z.input<typeof settingsInput>;

export async function saveInstanceSettings(input: SaveSettingsInput): Promise<Result<InstanceSettings>> {
  const admin = await requireAdmin();
  const parsed = settingsInput.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const smtp = parsed.data.smtp && parsed.data.smtp.host ? parsed.data.smtp : null;
  const next = saveSettings({ ...parsed.data, smtp });
  logAudit({ actorId: admin.id, action: "settings.saved", subjectType: "settings", subjectId: "instance", meta: { instanceName: next.instanceName, baseUrl: next.baseUrl, maxUploadMb: next.maxUploadMb, sessionDays: next.sessionDays, smtp: !!next.smtp } });
  refresh();
  return ok(next);
}

/** Sends the test template to `to` using the saved SMTP settings (save the form first). */
export async function sendTestEmail(to: string): Promise<Result<{ to: string }>> {
  const admin = await requireAdmin();
  const parsedTo = email.safeParse(to || admin.email);
  if (!parsedTo.success) return fail(firstIssue(parsedTo.error));
  if (!isEmailConfigured()) return fail("Save SMTP settings with a host and a from address first.");
  const mail = testEmail({ instanceName: getSettings().instanceName });
  const sent = await sendEmail({ to: parsedTo.data, ...mail });
  logAudit({ actorId: admin.id, action: "settings.test_email", subjectType: "settings", subjectId: "instance", meta: { to: parsedTo.data, ok: sent.ok } });
  if (!sent.ok) return fail(`Could not send: ${sent.error}`);
  return ok({ to: parsedTo.data });
}

// ---- Backups ----

function refreshBackups() {
  revalidatePath("/admin/backups");
}

export async function runBackupNow(): Promise<Result<BackupRow>> {
  const admin = await requireAdmin();
  try {
    const row = await createBackup({ createdBy: admin.id, kind: "manual" });
    logAudit({ actorId: admin.id, action: "backup.created", subjectType: "backup", subjectId: row.id, meta: { filename: row.filename, bytes: row.bytes } });
    refreshBackups();
    return ok(row);
  } catch (err) {
    console.error("[backup] manual backup failed:", err);
    return fail(`Backup failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function removeBackup(id: string): Promise<Result> {
  const admin = await requireAdmin();
  const removed = await deleteBackup(id);
  if (!removed) return fail("That backup no longer exists.");
  logAudit({ actorId: admin.id, action: "backup.deleted", subjectType: "backup", subjectId: id });
  refreshBackups();
  return ok(undefined);
}

const backupInput = z.object({
  enabled: z.boolean(),
  hour: z.coerce.number().int().min(0).max(23),
  keep: z.coerce.number().int("Whole numbers only").min(1, "Keep at least one backup").max(365, "At most 365"),
});
export type SaveBackupScheduleInput = z.input<typeof backupInput>;

export async function saveBackupSchedule(input: SaveBackupScheduleInput): Promise<Result<BackupSettings>> {
  const admin = await requireAdmin();
  const parsed = backupInput.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const next = saveSettings({ backup: parsed.data });
  const pruned = await pruneBackups(next.backup.keep);
  logAudit({ actorId: admin.id, action: "settings.backup_schedule", subjectType: "settings", subjectId: "instance", meta: { ...next.backup, pruned } });
  refreshBackups();
  return ok(next.backup);
}

// ---- Storage ----

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    const p = path.join(dir, e.name);
    total += e.isDirectory() ? await dirSize(p) : (await fsp.stat(p)).size;
  }
  return total;
}

/** Removes upload directories whose asset id no longer exists in the assets table. */
export async function sweepOrphanFiles(): Promise<Result<{ count: number; bytes: number }>> {
  const admin = await requireAdmin();
  let count = 0;
  let bytes = 0;
  const wsDirs = await fsp.readdir(UPLOAD_DIR, { withFileTypes: true }).catch(() => []);
  for (const wsDir of wsDirs) {
    if (!wsDir.isDirectory()) continue;
    const wsPath = path.join(UPLOAD_DIR, wsDir.name);
    const assetDirs = (await fsp.readdir(wsPath, { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory()).map((d) => d.name);
    if (assetDirs.length === 0) continue;
    const known = new Set(
      db.select({ id: schema.assets.id }).from(schema.assets).where(inArray(schema.assets.id, assetDirs)).all().map((r) => r.id),
    );
    for (const assetId of assetDirs) {
      if (known.has(assetId)) continue;
      const p = path.join(wsPath, assetId);
      bytes += await dirSize(p);
      await fsp.rm(p, { recursive: true, force: true });
      count++;
    }
    const remaining = await fsp.readdir(wsPath).catch(() => [] as string[]);
    if (remaining.length === 0) await fsp.rmdir(wsPath).catch(() => {});
  }
  logAudit({ actorId: admin.id, action: "storage.swept", subjectType: "storage", meta: { count, bytes } });
  refresh();
  return ok({ count, bytes });
}
