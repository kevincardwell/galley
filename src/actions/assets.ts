"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import type { Asset, User } from "@/db/schema";
import { requireUser } from "@/lib/auth/current";
import { assertAccess, type Verb } from "@/lib/permissions";
import { newId } from "@/lib/ids";
import { logActivity } from "@/lib/activity";
import { storage } from "@/lib/storage";
import { extOf } from "@/lib/media/mime";
import type { AssetSummary } from "@/lib/media/types";

// ---- helpers ----

/** Load an asset and check the caller's access to its workspace. Non-members see "Not found". */
function ownedAsset(user: User, assetId: string, verb: Verb): { asset: Asset; slug: string } {
  const asset = db.select().from(schema.assets).where(eq(schema.assets.id, assetId)).get();
  if (!asset) throw new Error("Not found");
  const { workspace } = assertAccess(user, asset.workspaceId, verb);
  return { asset, slug: workspace.slug };
}

function ownedFolder(user: User, folderId: string, verb: Verb) {
  const folder = db.select().from(schema.assetFolders).where(eq(schema.assetFolders.id, folderId)).get();
  if (!folder) throw new Error("Not found");
  const { workspace } = assertAccess(user, folder.workspaceId, verb);
  return { folder, slug: workspace.slug };
}

const revalidate = (slug: string) => revalidatePath(`/w/${slug}`, "layout");

const nameInput = z.string().trim().min(1, "Give it a name").max(180);
const tagInput = z.array(z.string().trim().min(1).max(40)).max(50);

// ---- assets ----

export async function renameAsset(assetId: string, filename: string): Promise<void> {
  const user = await requireUser();
  const { asset, slug } = ownedAsset(user, assetId, "edit");
  const base = nameInput.parse(filename.replace(/[\\/]/g, ""));
  // Keep the original extension so the type stays recognisable; the stored file never moves.
  const ext = extOf(asset.filename);
  const next = ext && extOf(base) !== ext ? `${base}${ext}` : base;
  if (next === asset.filename) return;
  db.update(schema.assets).set({ filename: next }).where(eq(schema.assets.id, asset.id)).run();
  logActivity({ workspaceId: asset.workspaceId, actorId: user.id, verb: "updated", subjectType: "asset", subjectId: asset.id, subjectTitle: next, meta: { renamedFrom: asset.filename } });
  revalidate(slug);
}

export async function deleteAsset(assetId: string): Promise<void> {
  const user = await requireUser();
  const { asset, slug } = ownedAsset(user, assetId, "edit");
  db.delete(schema.assets).where(eq(schema.assets.id, asset.id)).run();
  await storage.remove(asset.workspaceId, asset.id);
  logActivity({ workspaceId: asset.workspaceId, actorId: user.id, verb: "deleted", subjectType: "asset", subjectId: asset.id, subjectTitle: asset.filename });
  revalidate(slug);
}

export async function moveToFolder(assetId: string, folderId: string | null): Promise<void> {
  const user = await requireUser();
  const { asset, slug } = ownedAsset(user, assetId, "edit");
  let target: string | null = null;
  if (folderId) {
    const { folder } = ownedFolder(user, folderId, "edit");
    if (folder.workspaceId !== asset.workspaceId) throw new Error("Not found");
    target = folder.id;
  }
  db.update(schema.assets).set({ folderId: target }).where(eq(schema.assets.id, asset.id)).run();
  revalidate(slug);
}

export async function setTags(assetId: string, tags: string[]): Promise<void> {
  const user = await requireUser();
  const { asset, slug } = ownedAsset(user, assetId, "edit");
  const clean = [...new Set(tagInput.parse(tags).map((t) => t.toLowerCase()))];
  db.transaction((tx) => {
    tx.delete(schema.assetTags).where(eq(schema.assetTags.assetId, asset.id)).run();
    for (const tag of clean) tx.insert(schema.assetTags).values({ assetId: asset.id, tag }).run();
  });
  revalidate(slug);
}

// ---- folders ----

export async function createFolder(workspaceId: string, name: string): Promise<{ id: string }> {
  const user = await requireUser();
  const { workspace } = assertAccess(user, workspaceId, "edit");
  const clean = nameInput.parse(name);
  const last = db
    .select({ position: schema.assetFolders.position })
    .from(schema.assetFolders)
    .where(eq(schema.assetFolders.workspaceId, workspace.id))
    .orderBy(schema.assetFolders.position)
    .all()
    .at(-1);
  const id = newId();
  db.insert(schema.assetFolders).values({ id, workspaceId: workspace.id, name: clean, position: (last?.position ?? -1) + 1 }).run();
  revalidate(workspace.slug);
  return { id };
}

export async function renameFolder(folderId: string, name: string): Promise<void> {
  const user = await requireUser();
  const { folder, slug } = ownedFolder(user, folderId, "edit");
  db.update(schema.assetFolders).set({ name: nameInput.parse(name) }).where(eq(schema.assetFolders.id, folder.id)).run();
  revalidate(slug);
}

/** Deletes the folder; its assets go back to the root. */
export async function deleteFolder(folderId: string): Promise<void> {
  const user = await requireUser();
  const { folder, slug } = ownedFolder(user, folderId, "edit");
  db.transaction((tx) => {
    tx.update(schema.assets).set({ folderId: null }).where(eq(schema.assets.folderId, folder.id)).run();
    tx.delete(schema.assetFolders).where(eq(schema.assetFolders.id, folder.id)).run();
  });
  revalidate(slug);
}

// ---- attachments (contract used by tasks and copy) ----

export async function attachAsset(assetId: string, target: { taskId?: string; sectionId?: string }): Promise<void> {
  const user = await requireUser();
  const { asset, slug } = ownedAsset(user, assetId, "edit");
  const taskId = target.taskId ?? null;
  const sectionId = taskId ? null : (target.sectionId ?? null);
  if (!taskId && !sectionId) throw new Error("Nothing to attach to");

  let title: string;
  if (taskId) {
    const task = db.select({ title: schema.tasks.title }).from(schema.tasks).where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.workspaceId, asset.workspaceId))).get();
    if (!task) throw new Error("Not found");
    title = task.title;
  } else {
    const section = db.select({ title: schema.sections.title }).from(schema.sections).where(and(eq(schema.sections.id, sectionId!), eq(schema.sections.workspaceId, asset.workspaceId))).get();
    if (!section) throw new Error("Not found");
    title = section.title;
  }

  const existing = db
    .select({ id: schema.attachments.id })
    .from(schema.attachments)
    .where(and(eq(schema.attachments.assetId, asset.id), taskId ? eq(schema.attachments.taskId, taskId) : eq(schema.attachments.sectionId, sectionId!)))
    .get();
  if (existing) return;

  db.insert(schema.attachments).values({ id: newId(), assetId: asset.id, taskId, sectionId }).onConflictDoNothing().run();
  logActivity({
    workspaceId: asset.workspaceId,
    actorId: user.id,
    verb: "attached",
    subjectType: "asset",
    subjectId: asset.id,
    subjectTitle: asset.filename,
    meta: { taskId, sectionId, targetTitle: title },
  });
  revalidate(slug);
}

export async function detachAsset(attachmentId: string): Promise<void> {
  const user = await requireUser();
  const row = db
    .select({ id: schema.attachments.id, assetId: schema.attachments.assetId })
    .from(schema.attachments)
    .where(eq(schema.attachments.id, attachmentId))
    .get();
  if (!row) throw new Error("Not found");
  const { slug } = ownedAsset(user, row.assetId, "edit");
  db.delete(schema.attachments).where(eq(schema.attachments.id, row.id)).run();
  revalidate(slug);
}

/** Lightweight list for the attach picker. Any member may read it. */
export async function listAssetsForPicker(workspaceId: string): Promise<AssetSummary[]> {
  const user = await requireUser();
  const { workspace } = assertAccess(user, workspaceId, "view");
  return db
    .select({
      id: schema.assets.id,
      filename: schema.assets.filename,
      kind: schema.assets.kind,
      width: schema.assets.width,
      height: schema.assets.height,
      processedAt: schema.assets.processedAt,
    })
    .from(schema.assets)
    .where(eq(schema.assets.workspaceId, workspace.id))
    .orderBy(schema.assets.createdAt)
    .all()
    .reverse();
}
