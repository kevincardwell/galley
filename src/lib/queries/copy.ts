import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { asDoc } from "@/lib/copy/serialize";
import type { AttachedFile, CommentRow, PageRow, SectionDetails, SectionRow, VersionRow } from "@/lib/copy/types";

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
  return { versions: listVersions(sectionId), comments: listComments(sectionId), attachments: listSectionAttachments(sectionId) };
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
