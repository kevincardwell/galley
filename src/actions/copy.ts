"use server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notifyMentions } from "@/lib/notify";
import { db, schema } from "@/db/client";
import { SECTION_STATUSES, type SectionStatus } from "@/db/schema";
import { requireUser } from "@/lib/auth/current";
import { assertAccess } from "@/lib/permissions";
import { newId } from "@/lib/ids";
import { slugify } from "@/lib/slug";
import { logActivity } from "@/lib/activity";
import { asDoc } from "@/lib/copy/serialize";
import type { TiptapDoc } from "@/lib/copy/serialize";
import type { SaveResult } from "@/lib/copy/types";
import { getRoom, peekRoom, persistRoom, replaceDoc } from "@/lib/collab/hub";

const MAX_TITLE = 120;

const nowSec = () => Math.floor(Date.now() / 1000);

function cleanTitle(title: string, fallback: string): string {
  const t = title.trim().replace(/\s+/g, " ").slice(0, MAX_TITLE);
  return t || fallback;
}

function uniquePageSlug(workspaceId: string, title: string, exceptId?: string): string {
  const base = slugify(title);
  let slug = base;
  let i = 2;
  while (true) {
    const hit = db
      .select({ id: schema.pages.id })
      .from(schema.pages)
      .where(and(eq(schema.pages.workspaceId, workspaceId), eq(schema.pages.slug, slug)))
      .get();
    if (!hit || hit.id === exceptId) return slug;
    slug = `${base}-${i++}`;
  }
}

function pageOrThrow(pageId: string) {
  const page = db.select().from(schema.pages).where(eq(schema.pages.id, pageId)).get();
  if (!page) throw new Error("Not found");
  return page;
}

function sectionOrThrow(sectionId: string) {
  const row = db
    .select({ section: schema.sections, pageSlug: schema.pages.slug })
    .from(schema.sections)
    .innerJoin(schema.pages, eq(schema.pages.id, schema.sections.pageId))
    .where(eq(schema.sections.id, sectionId))
    .get();
  if (!row) throw new Error("Not found");
  return row;
}

function copyPath(slug: string, pageSlug?: string) {
  return pageSlug ? `/w/${slug}/copy/${pageSlug}` : `/w/${slug}/copy`;
}

function nextPosition(table: "pages" | "sections", parentId: string): number {
  const row =
    table === "pages"
      ? db.select({ m: sql<number | null>`max(${schema.pages.position})` }).from(schema.pages).where(eq(schema.pages.workspaceId, parentId)).get()
      : db.select({ m: sql<number | null>`max(${schema.sections.position})` }).from(schema.sections).where(eq(schema.sections.pageId, parentId)).get();
  return (row?.m ?? -1) + 1;
}

// ---------------------------------------------------------------- pages

export async function createPage(workspaceId: string, title: string): Promise<{ id: string; slug: string }> {
  const user = await requireUser();
  const { workspace } = assertAccess(user, workspaceId, "edit");
  const name = cleanTitle(title, "Untitled page");
  const id = newId();
  const slug = uniquePageSlug(workspace.id, name);
  db.insert(schema.pages).values({ id, workspaceId: workspace.id, title: name, slug, position: nextPosition("pages", workspace.id) }).run();
  logActivity({ workspaceId: workspace.id, actorId: user.id, verb: "created", subjectType: "page", subjectId: id, subjectTitle: name });
  revalidatePath(copyPath(workspace.slug), "layout");
  return { id, slug };
}

export async function renamePage(pageId: string, title: string): Promise<{ slug: string }> {
  const user = await requireUser();
  const page = pageOrThrow(pageId);
  const { workspace } = assertAccess(user, page.workspaceId, "edit");
  const name = cleanTitle(title, page.title);
  const slug = name === page.title ? page.slug : uniquePageSlug(workspace.id, name, page.id);
  db.update(schema.pages).set({ title: name, slug }).where(eq(schema.pages.id, page.id)).run();
  logActivity({ workspaceId: workspace.id, actorId: user.id, verb: "updated", subjectType: "page", subjectId: page.id, subjectTitle: name });
  revalidatePath(copyPath(workspace.slug), "layout");
  return { slug };
}

export async function deletePage(pageId: string): Promise<void> {
  const user = await requireUser();
  const page = pageOrThrow(pageId);
  const { workspace } = assertAccess(user, page.workspaceId, "edit");
  db.delete(schema.pages).where(eq(schema.pages.id, page.id)).run();
  logActivity({ workspaceId: workspace.id, actorId: user.id, verb: "deleted", subjectType: "page", subjectId: page.id, subjectTitle: page.title });
  revalidatePath(copyPath(workspace.slug), "layout");
}

export async function reorderPages(workspaceId: string, orderedIds: string[]): Promise<void> {
  const user = await requireUser();
  const { workspace } = assertAccess(user, workspaceId, "edit");
  db.transaction((tx) => {
    orderedIds.forEach((id, i) => {
      tx.update(schema.pages).set({ position: i }).where(and(eq(schema.pages.id, id), eq(schema.pages.workspaceId, workspace.id))).run();
    });
  });
  revalidatePath(copyPath(workspace.slug), "layout");
}

// ---------------------------------------------------------------- sections

export async function createSection(pageId: string, title: string): Promise<{ id: string }> {
  const user = await requireUser();
  const page = pageOrThrow(pageId);
  const { workspace } = assertAccess(user, page.workspaceId, "edit");
  const name = cleanTitle(title, "Untitled section");
  const id = newId();
  const content: TiptapDoc = { type: "doc", content: [] };
  db.transaction((tx) => {
    tx.insert(schema.sections)
      .values({ id, pageId: page.id, workspaceId: workspace.id, title: name, content, plainText: "", position: nextPosition("sections", page.id), version: 1, updatedBy: user.id, updatedAt: nowSec() })
      .run();
    tx.insert(schema.sectionVersions).values({ id: newId(), sectionId: id, version: 1, content, plainText: "", wordCount: 0, createdBy: user.id }).run();
  });
  logActivity({ workspaceId: workspace.id, actorId: user.id, verb: "created", subjectType: "section", subjectId: id, subjectTitle: name, meta: { page: page.title } });
  revalidatePath(copyPath(workspace.slug, page.slug));
  return { id };
}

export async function renameSection(sectionId: string, title: string): Promise<void> {
  const user = await requireUser();
  const { section, pageSlug } = sectionOrThrow(sectionId);
  const { workspace } = assertAccess(user, section.workspaceId, "edit");
  const name = cleanTitle(title, section.title);
  if (name === section.title) return;
  db.update(schema.sections).set({ title: name }).where(eq(schema.sections.id, section.id)).run();
  logActivity({ workspaceId: workspace.id, actorId: user.id, verb: "updated", subjectType: "section", subjectId: section.id, subjectTitle: name });
  revalidatePath(copyPath(workspace.slug, pageSlug));
}

export async function deleteSection(sectionId: string): Promise<void> {
  const user = await requireUser();
  const { section, pageSlug } = sectionOrThrow(sectionId);
  const { workspace } = assertAccess(user, section.workspaceId, "edit");
  db.delete(schema.sections).where(eq(schema.sections.id, section.id)).run();
  logActivity({ workspaceId: workspace.id, actorId: user.id, verb: "deleted", subjectType: "section", subjectId: section.id, subjectTitle: section.title });
  revalidatePath(copyPath(workspace.slug, pageSlug));
}

export async function reorderSections(pageId: string, orderedIds: string[]): Promise<void> {
  const user = await requireUser();
  const page = pageOrThrow(pageId);
  const { workspace } = assertAccess(user, page.workspaceId, "edit");
  db.transaction((tx) => {
    orderedIds.forEach((id, i) => {
      tx.update(schema.sections).set({ position: i }).where(and(eq(schema.sections.id, id), eq(schema.sections.pageId, page.id))).run();
    });
  });
  revalidatePath(copyPath(workspace.slug, page.slug));
}

/**
 * "Save now" for a collaborative section. Content no longer travels through
 * this action: edits reach the server as Yjs updates via /api/collab, where
 * they are logged immediately and compacted on a timer. This forces that
 * compaction (and the version/plain-text snapshot) right away, for Cmd+S.
 */
export async function saveSection(sectionId: string): Promise<SaveResult> {
  const user = await requireUser();
  const { section, pageSlug } = sectionOrThrow(sectionId);
  const { workspace } = assertAccess(user, section.workspaceId, "edit");
  const room = getRoom(section.id);
  const saved = room ? persistRoom(room, user.id) : null;
  revalidatePath(copyPath(workspace.slug, pageSlug));
  return { conflict: false, version: saved?.version ?? section.version, updatedAt: saved?.updatedAt ?? section.updatedAt };
}

/**
 * Applies the current live document of a section to its classic columns.
 * The hub does this on its own schedule; actions that need the columns fresh
 * (exports, status changes) can call it first. Not a public action: it takes
 * no user input beyond the id and only touches rooms already loaded.
 */
export async function snapshotSection(sectionId: string): Promise<{ version: number; updatedAt: number } | null> {
  const user = await requireUser();
  const { section } = sectionOrThrow(sectionId);
  assertAccess(user, section.workspaceId, "edit");
  const room = peekRoom(section.id);
  return room ? persistRoom(room, user.id) : null;
}

export async function setSectionStatus(sectionId: string, status: SectionStatus): Promise<void> {
  const user = await requireUser();
  if (!SECTION_STATUSES.includes(status)) throw new Error("Unknown status");
  const { section } = sectionOrThrow(sectionId);
  const { workspace } = assertAccess(user, section.workspaceId, "edit");
  if (section.status === status) return;
  db.update(schema.sections).set({ status }).where(eq(schema.sections.id, section.id)).run();
  logActivity({
    workspaceId: workspace.id,
    actorId: user.id,
    verb: status === "approved" ? "approved" : "updated",
    subjectType: "section",
    subjectId: section.id,
    subjectTitle: section.title,
    meta: { status },
  });
  revalidatePath(copyPath(workspace.slug), "layout");
}

/**
 * Copies an old version forward as a brand-new version; history is never rewritten.
 *
 * This goes through the live document, not the columns: the editor is driven
 * entirely by Yjs, so a restore written only to sections.content is invisible
 * and gets overwritten by the next persist.
 */
export async function restoreVersion(sectionId: string, versionId: string): Promise<{ version: number }> {
  const user = await requireUser();
  const { section, pageSlug } = sectionOrThrow(sectionId);
  const { workspace } = assertAccess(user, section.workspaceId, "edit");
  const old = db
    .select()
    .from(schema.sectionVersions)
    .where(and(eq(schema.sectionVersions.id, versionId), eq(schema.sectionVersions.sectionId, section.id)))
    .get();
  if (!old) throw new Error("Not found");
  const saved = replaceDoc(section.id, asDoc(old.content), user.id);
  if (!saved) throw new Error("Not found");
  logActivity({ workspaceId: workspace.id, actorId: user.id, verb: "restored", subjectType: "section", subjectId: section.id, subjectTitle: section.title, meta: { fromVersion: old.version } });
  revalidatePath(copyPath(workspace.slug, pageSlug));
  return { version: saved.version };
}

// ---------------------------------------------------------------- comments

export async function addComment(sectionId: string, body: string): Promise<{ id: string }> {
  const user = await requireUser();
  const { section, pageSlug } = sectionOrThrow(sectionId);
  const { workspace } = assertAccess(user, section.workspaceId, "edit");
  const text = body.trim().slice(0, 4000);
  if (!text) throw new Error("Write something first");
  const id = newId();
  db.insert(schema.comments).values({ id, workspaceId: workspace.id, sectionId: section.id, body: text, authorId: user.id }).run();
  logActivity({ workspaceId: workspace.id, actorId: user.id, verb: "commented", subjectType: "section", subjectId: section.id, subjectTitle: section.title });
  await notifyMentions({ text, workspaceId: workspace.id, actorId: user.id, href: `${copyPath(workspace.slug, pageSlug)}#s-${section.id}`, context: `a comment on “${section.title}”` });
  revalidatePath(copyPath(workspace.slug, pageSlug));
  return { id };
}

export async function resolveComment(commentId: string): Promise<void> {
  const user = await requireUser();
  const comment = db.select().from(schema.comments).where(eq(schema.comments.id, commentId)).get();
  if (!comment || !comment.sectionId) throw new Error("Not found");
  const { workspace } = assertAccess(user, comment.workspaceId, "edit");
  const { pageSlug } = sectionOrThrow(comment.sectionId);
  db.update(schema.comments).set({ resolvedAt: comment.resolvedAt ? null : nowSec() }).where(eq(schema.comments.id, comment.id)).run();
  revalidatePath(copyPath(workspace.slug, pageSlug));
}

/** Convenience for the empty-page state: the first section of a page. */
export async function createFirstSection(pageId: string): Promise<{ id: string }> {
  return createSection(pageId, "Start writing");
}
