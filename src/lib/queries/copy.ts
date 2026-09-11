import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { asDoc } from "@/lib/copy/serialize";
import type { AttachedFile, CommentRow, PageRow, SectionDetails, SectionRow, ShareSectionReview, VersionRow } from "@/lib/copy/types";

/** Pages of a workspace in order, with per-page section status counts. */
export function listPages(workspaceId: string): PageRow[] {
  return db
    .select({
      id: schema.pages.id,
      title: schema.pages.title,
      slug: schema.pages.slug,
      position: schema.pages.position,
      total: sql<number>`(select count(*) from sections s where s.page_id = ${schema.pages.id})`,
      approved: sql<number>`(select count(*) from sections s where s.page_id = ${schema.pages.id} and s.status = 'approved')`,
      review: sql<number>`(select count(*) from sections s where s.page_id = ${schema.pages.id} and s.status = 'review')`,
    })
    .from(schema.pages)
    .where(eq(schema.pages.workspaceId, workspaceId))
    .orderBy(asc(schema.pages.position), asc(schema.pages.createdAt))
    .all()
    .map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      position: p.position,
      counts: { total: p.total, approved: p.approved, review: p.review, draft: p.total - p.approved - p.review },
    }));
}

export function findPage(workspaceId: string, slug: string) {
  return db
    .select()
    .from(schema.pages)
    .where(and(eq(schema.pages.workspaceId, workspaceId), eq(schema.pages.slug, slug)))
    .get();
}

export function firstPage(workspaceId: string) {
  return db
    .select()
    .from(schema.pages)
    .where(eq(schema.pages.workspaceId, workspaceId))
    .orderBy(asc(schema.pages.position), asc(schema.pages.createdAt))
    .get();
}

/** Sections of a page in order, with the last editor's name. */
export function listSections(pageId: string): SectionRow[] {
  return db
    .select({ s: schema.sections, updatedByName: schema.users.name })
    .from(schema.sections)
    .leftJoin(schema.users, eq(schema.users.id, schema.sections.updatedBy))
    .where(eq(schema.sections.pageId, pageId))
    .orderBy(asc(schema.sections.position), asc(schema.sections.updatedAt))
    .all()
    .map(({ s, updatedByName }) => ({
      id: s.id,
      pageId: s.pageId,
      title: s.title,
      content: asDoc(s.content),
      status: s.status,
      wordCount: s.wordCount,
      position: s.position,
      version: s.version,
      updatedAt: s.updatedAt,
      updatedByName: updatedByName ?? null,
    }));
}

/** Newest first. The newest row matches the section's current version. */
export function listVersions(sectionId: string, limit = 9): VersionRow[] {
  return db
    .select({
      id: schema.sectionVersions.id,
      version: schema.sectionVersions.version,
      wordCount: schema.sectionVersions.wordCount,
      createdAt: schema.sectionVersions.createdAt,
      authorName: schema.users.name,
      plainText: schema.sectionVersions.plainText,
    })
    .from(schema.sectionVersions)
    .leftJoin(schema.users, eq(schema.users.id, schema.sectionVersions.createdBy))
    .where(eq(schema.sectionVersions.sectionId, sectionId))
    .orderBy(desc(schema.sectionVersions.version), desc(schema.sectionVersions.createdAt))
    .limit(limit)
    .all();
}

export function listComments(sectionId: string): CommentRow[] {
  return db
    .select({
      id: schema.comments.id,
      body: schema.comments.body,
      createdAt: schema.comments.createdAt,
      resolvedAt: schema.comments.resolvedAt,
      authorName: schema.users.name,
      guestName: schema.comments.guestName,
    })
    .from(schema.comments)
    .leftJoin(schema.users, eq(schema.users.id, schema.comments.authorId))
    .where(eq(schema.comments.sectionId, sectionId))
    .orderBy(asc(schema.comments.createdAt))
    .all();
}

export function listSectionAttachments(sectionId: string): AttachedFile[] {
  return db
    .select({ attachmentId: schema.attachments.id, assetId: schema.assets.id, filename: schema.assets.filename, kind: schema.assets.kind })
    .from(schema.attachments)
    .innerJoin(schema.assets, eq(schema.assets.id, schema.attachments.assetId))
    .where(eq(schema.attachments.sectionId, sectionId))
    .orderBy(asc(schema.attachments.createdAt))
    .all();
}

export function sectionDetails(sectionId: string): SectionDetails {
  return { versions: listVersions(sectionId), comments: listComments(sectionId), attachments: listSectionAttachments(sectionId), ...sectionClientReview(sectionId) };
}

// ---- Share link (public, read-only) ----

export function workspaceByShareToken(token: string) {
  if (!token) return undefined;
  return db.select().from(schema.workspaces).where(eq(schema.workspaces.shareToken, token)).get();
}

export function listAssets(workspaceId: string) {
  return db
    .select({ id: schema.assets.id, filename: schema.assets.filename, kind: schema.assets.kind, bytes: schema.assets.bytes, width: schema.assets.width, height: schema.assets.height })
    .from(schema.assets)
    .where(eq(schema.assets.workspaceId, workspaceId))
    .orderBy(desc(schema.assets.createdAt))
    .all();
}

// ---- Client review (share link) ----

/** The client-approval state of a section plus whether its workspace lets clients review at all. */
export function sectionClientReview(sectionId: string): Pick<SectionDetails, "shareReview" | "clientApprovedAt" | "clientApprovedBy"> {
  const row = db
    .select({ shareReview: schema.workspaces.shareReview, clientApprovedAt: schema.sections.clientApprovedAt, clientApprovedBy: schema.sections.clientApprovedBy })
    .from(schema.sections)
    .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.sections.workspaceId))
    .where(eq(schema.sections.id, sectionId))
    .get();
  return { shareReview: row?.shareReview ?? false, clientApprovedAt: row?.clientApprovedAt ?? null, clientApprovedBy: row?.clientApprovedBy ?? null };
}

/** Unresolved comments and client approval for every section of a page, keyed by section id. Used by the share page. */
export function shareReviewForPage(pageId: string): Record<string, ShareSectionReview> {
  const out: Record<string, ShareSectionReview> = {};
  const secs = db
    .select({ id: schema.sections.id, clientApprovedAt: schema.sections.clientApprovedAt, clientApprovedBy: schema.sections.clientApprovedBy })
    .from(schema.sections)
    .where(eq(schema.sections.pageId, pageId))
    .all();
  for (const s of secs) out[s.id] = { comments: [], clientApprovedAt: s.clientApprovedAt, clientApprovedBy: s.clientApprovedBy };
  const rows = db
    .select({ id: schema.comments.id, sectionId: schema.comments.sectionId, body: schema.comments.body, createdAt: schema.comments.createdAt, authorName: schema.users.name, guestName: schema.comments.guestName })
    .from(schema.comments)
    .innerJoin(schema.sections, eq(schema.sections.id, schema.comments.sectionId))
    .leftJoin(schema.users, eq(schema.users.id, schema.comments.authorId))
    .where(and(eq(schema.sections.pageId, pageId), isNull(schema.comments.resolvedAt)))
    .orderBy(asc(schema.comments.createdAt))
    .all();
  for (const c of rows) {
    if (!c.sectionId) continue;
    out[c.sectionId]?.comments.push({ id: c.id, body: c.body, createdAt: c.createdAt, name: c.guestName ?? c.authorName ?? "Someone" });
  }
  return out;
}

// ---- Collaboration ----

/** The un-compacted Yjs updates of a section, oldest first. Applied on top of sections.ydoc when a room loads. */
export function listCollabUpdates(sectionId: string): { id: number; update: Buffer }[] {
  return db
    .select({ id: schema.collabUpdates.id, update: schema.collabUpdates.update })
    .from(schema.collabUpdates)
    .where(eq(schema.collabUpdates.sectionId, sectionId))
    .orderBy(asc(schema.collabUpdates.id))
    .all();
}

/** How many updates await compaction; handy for diagnostics and tests. */
export function countCollabUpdates(sectionId: string): number {
  const row = db.select({ n: sql<number>`count(*)` }).from(schema.collabUpdates).where(eq(schema.collabUpdates.sectionId, sectionId)).get();
  return row?.n ?? 0;
}
