import "server-only";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { AssetCounts, AssetFilters, AssetFolder, AssetItem, AssetUsage } from "@/lib/media/types";

/** Every asset in a workspace with tags and where it is used. Filtering happens in memory; fine below a few thousand rows. */
export function listAssets(workspaceId: string, slug: string): AssetItem[] {
  const rows = db
    .select({ asset: schema.assets, uploadedByName: schema.users.name })
    .from(schema.assets)
    .leftJoin(schema.users, eq(schema.users.id, schema.assets.uploadedBy))
    .where(eq(schema.assets.workspaceId, workspaceId))
    .orderBy(desc(schema.assets.createdAt))
    .all();
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.asset.id);

  const tags = new Map<string, string[]>();
  for (const t of db.select().from(schema.assetTags).where(inArray(schema.assetTags.assetId, ids)).orderBy(asc(schema.assetTags.tag)).all()) {
    (tags.get(t.assetId) ?? tags.set(t.assetId, []).get(t.assetId)!).push(t.tag);
  }

  const usage = new Map<string, AssetUsage[]>();
  const links = db
    .select({
      assetId: schema.attachments.assetId,
      taskId: schema.attachments.taskId,
      taskTitle: schema.tasks.title,
      sectionId: schema.attachments.sectionId,
      sectionTitle: schema.sections.title,
      pageTitle: schema.pages.title,
      pageSlug: schema.pages.slug,
    })
    .from(schema.attachments)
    .leftJoin(schema.tasks, eq(schema.tasks.id, schema.attachments.taskId))
    .leftJoin(schema.sections, eq(schema.sections.id, schema.attachments.sectionId))
    .leftJoin(schema.pages, eq(schema.pages.id, schema.sections.pageId))
    .where(inArray(schema.attachments.assetId, ids))
    .all();
  for (const l of links) {
    const list = usage.get(l.assetId) ?? usage.set(l.assetId, []).get(l.assetId)!;
    if (l.taskId && l.taskTitle) list.push({ type: "task", id: l.taskId, title: l.taskTitle, href: `/w/${slug}/tasks?task=${l.taskId}` });
    else if (l.sectionId && l.sectionTitle) {
      list.push({ type: "section", id: l.sectionId, title: l.pageTitle ? `${l.pageTitle} › ${l.sectionTitle}` : l.sectionTitle, href: `/w/${slug}/copy/${l.pageSlug ?? ""}#${l.sectionId}` });
    }
  }

  return rows.map(({ asset, uploadedByName }) => ({
    id: asset.id,
    workspaceId: asset.workspaceId,
    folderId: asset.folderId,
    kind: asset.kind,
    filename: asset.filename,
    mime: asset.mime,
    bytes: asset.bytes,
    width: asset.width,
    height: asset.height,
    durationMs: asset.durationMs,
    palette: asset.palette ?? null,
    processedAt: asset.processedAt,
    processError: asset.processError,
    // A client who sent the file in has no account, so their name lives on the asset itself.
    uploadedByName: uploadedByName ?? asset.guestName,
    fromClient: !!asset.guestName,
    createdAt: asset.createdAt,
    tags: tags.get(asset.id) ?? [],
    usedIn: usage.get(asset.id) ?? [],
  }));
}

export function applyFilters(items: AssetItem[], f: AssetFilters): AssetItem[] {
  return items.filter(
    (a) =>
      (!f.kind || a.kind === f.kind) &&
      (!f.tag || a.tags.includes(f.tag)) &&
      (!f.folder || a.folderId === f.folder) &&
      (!f.unused || a.usedIn.length === 0),
  );
}

export function countAssets(items: AssetItem[]): AssetCounts {
  const c: AssetCounts = { all: items.length, image: 0, video: 0, pdf: 0, unused: 0 };
  for (const a of items) {
    c[a.kind]++;
    if (a.usedIn.length === 0) c.unused++;
  }
  return c;
}

export function tagCounts(items: AssetItem[]): { tag: string; count: number }[] {
  const m = new Map<string, number>();
  for (const a of items) for (const t of a.tags) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m].map(([tag, count]) => ({ tag, count })).sort((x, y) => y.count - x.count || x.tag.localeCompare(y.tag));
}

export function listFolders(workspaceId: string, items: AssetItem[]): AssetFolder[] {
  const counts = new Map<string, number>();
  for (const a of items) if (a.folderId) counts.set(a.folderId, (counts.get(a.folderId) ?? 0) + 1);
  return db
    .select({ id: schema.assetFolders.id, name: schema.assetFolders.name })
    .from(schema.assetFolders)
    .where(eq(schema.assetFolders.workspaceId, workspaceId))
    .orderBy(asc(schema.assetFolders.position), asc(schema.assetFolders.name))
    .all()
    .map((f) => ({ ...f, count: counts.get(f.id) ?? 0 }));
}

/** Bytes of originals in a workspace, from the database (derived files add a few percent on disk). */
export function workspaceStorageBytes(workspaceId: string): number {
  const row = db
    .select({ total: sql<number | null>`sum(${schema.assets.bytes})` })
    .from(schema.assets)
    .where(eq(schema.assets.workspaceId, workspaceId))
    .get();
  return row?.total ?? 0;
}
