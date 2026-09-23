"use server";
import { and, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db/client";
import { newId } from "@/lib/ids";
import { logActivity } from "@/lib/activity";
import { cleanGuestName, guestRateLimit, shareWorkspace } from "@/lib/share/guard";
import { notifyShareTeam } from "@/lib/share/notify";
import { replaceText } from "@/lib/collab/hub";
import { asDoc, docToEditableText } from "@/lib/copy/serialize";

/**
 * Guest writes through the share link. There is no signed-in user here: the
 * token is the whole key, and the workspace must have client review switched on.
 */

const MAX_BODY = 2000;
const MAX_SECTION_TEXT = 20_000;

function cleanBody(body: string): string {
  const b = (body ?? "").trim().slice(0, MAX_BODY);
  if (!b) throw new Error("Write something first");
  return b;
}

/** Workspace + section + page for a share token, or throws "Not found" without saying why. */
function guestContext(token: string, sectionId: string) {
  if (!sectionId) throw new Error("Not found");
  const ws = shareWorkspace(token, "shareReview");
  if (!ws) throw new Error("Not found");
  const row = db
    .select({ section: schema.sections, pageSlug: schema.pages.slug, pageTitle: schema.pages.title })
    .from(schema.sections)
    .innerJoin(schema.pages, eq(schema.pages.id, schema.sections.pageId))
    .where(and(eq(schema.sections.id, sectionId), eq(schema.sections.workspaceId, ws.id)))
    .get();
  if (!row) throw new Error("Not found");
  return { ws, ...row };
}

function revalidate(ws: { slug: string; shareToken: string | null }, pageSlug: string) {
  // The whole share view: the layout's "waiting on you" list changes along with the page.
  revalidatePath(`/share/${ws.shareToken}`, "layout");
  revalidatePath(`/w/${ws.slug}/copy/${pageSlug}`);
}

export async function guestComment(token: string, sectionId: string, name: string, body: string): Promise<{ id: string }> {
  const guest = cleanGuestName(name);
  const text = cleanBody(body);
  const { ws, section, pageSlug, pageTitle } = guestContext(token, sectionId);
  guestRateLimit(token, 30);
  const id = newId();
  db.insert(schema.comments).values({ id, workspaceId: ws.id, sectionId: section.id, body: text, authorId: null, guestName: guest }).run();
  logActivity({ workspaceId: ws.id, actorId: null, verb: "commented", subjectType: "section", subjectId: section.id, subjectTitle: section.title, meta: { guest } });
  await notifyShareTeam(ws.id, "client_comment", `${guest} commented on ${pageTitle} › ${section.title}`, text.length > 160 ? `${text.slice(0, 157)}…` : text, `/w/${ws.slug}/copy/${pageSlug}#s-${section.id}`);
  revalidate(ws, pageSlug);
  return { id };
}

export async function guestApprove(token: string, sectionId: string, name: string, approve: boolean): Promise<{ approvedAt: number | null }> {
  const guest = cleanGuestName(name);
  const { ws, section, pageSlug, pageTitle } = guestContext(token, sectionId);
  guestRateLimit(token, 30);
  const approvedAt = approve ? Math.floor(Date.now() / 1000) : null;
  db.update(schema.sections)
    .set({ clientApprovedAt: approvedAt, clientApprovedBy: approve ? guest : null })
    .where(eq(schema.sections.id, section.id))
    .run();
  logActivity({ workspaceId: ws.id, actorId: null, verb: approve ? "approved" : "updated", subjectType: "section", subjectId: section.id, subjectTitle: section.title, meta: { guest, clientApproved: approve } });
  if (approve) await notifyShareTeam(ws.id, "client_approved", `${guest} approved ${pageTitle} › ${section.title}`, null, `/w/${ws.slug}/copy/${pageSlug}#s-${section.id}`);
  revalidate(ws, pageSlug);
  return { approvedAt };
}

/**
 * The client writes a section themselves.
 *
 * Two opt-ins are required: client review on the workspace, and this particular
 * section handed over by someone with edit rights. Their text goes in through
 * the live document, not the column — the editor is Yjs-driven, so a write
 * straight to sections.content would be invisible and then overwritten by the
 * next persist. Every save lands in the version history like any other.
 */
export async function guestWriteSection(token: string, sectionId: string, name: string, text: string): Promise<{ version: number }> {
  const guest = cleanGuestName(name);
  const { ws, section, pageSlug, pageTitle } = guestContext(token, sectionId);
  if (!section.clientCanWrite) throw new Error("Not found");
  guestRateLimit(`write:${token}`, 60);

  const body = (text ?? "").slice(0, MAX_SECTION_TEXT);
  if (!body.trim()) throw new Error("Write something first");

  const saved = replaceText(section.id, body, null);
  if (!saved) throw new Error("Not found");

  logActivity({
    workspaceId: ws.id,
    actorId: null,
    verb: "updated",
    subjectType: "section",
    subjectId: section.id,
    subjectTitle: section.title,
    meta: { guest, clientWrote: true },
  });
  await notifyShareTeam(
    ws.id,
    "client_wrote",
    `${guest} wrote ${pageTitle} \u203a ${section.title}`,
    body.length > 160 ? `${body.slice(0, 157)}\u2026` : body,
    `/w/${ws.slug}/copy/${pageSlug}#s-${section.id}`,
  );
  revalidate(ws, pageSlug);
  return { version: saved.version };
}

/**
 * The client proposes new wording for a section instead of describing it in a
 * comment. Stored as a comment carrying the proposed text and the text they
 * started from; the studio accepts it (acceptSuggestion) or resolves it.
 */
export async function guestSuggest(token: string, sectionId: string, name: string, text: string, note = ""): Promise<{ id: string }> {
  const guest = cleanGuestName(name);
  const { ws, section, pageSlug, pageTitle } = guestContext(token, sectionId);
  guestRateLimit(token, 30);

  const proposed = (text ?? "").slice(0, MAX_SECTION_TEXT).trim();
  if (!proposed) throw new Error("Write something first");
  // What the share page showed them, so the studio sees exactly what they changed.
  const base = docToEditableText(asDoc(section.content));
  if (proposed === base.trim()) throw new Error("That is the same as the wording now");
  const why = (note ?? "").trim().slice(0, MAX_BODY);

  const id = newId();
  db.insert(schema.comments).values({ id, workspaceId: ws.id, sectionId: section.id, body: why, authorId: null, guestName: guest, suggestion: proposed, suggestionBase: base }).run();
  logActivity({ workspaceId: ws.id, actorId: null, verb: "commented", subjectType: "section", subjectId: section.id, subjectTitle: section.title, meta: { guest, suggestion: true } });
  await notifyShareTeam(ws.id, "client_suggested", `${guest} suggested new wording for ${pageTitle} \u203a ${section.title}`, why || null, `/w/${ws.slug}/copy/${pageSlug}#s-${section.id}`);
  revalidate(ws, pageSlug);
  return { id };
}

/** Approves every section on a page that is ready for it (not a draft) and not yet approved by the client. One notification, not one per section. */
export async function guestApprovePage(token: string, pageSlug: string, name: string): Promise<{ approved: number }> {
  const guest = cleanGuestName(name);
  const ws = shareWorkspace(token, "shareReview");
  if (!ws) throw new Error("Not found");
  const page = db.select().from(schema.pages).where(and(eq(schema.pages.workspaceId, ws.id), eq(schema.pages.slug, pageSlug))).get();
  if (!page) throw new Error("Not found");
  guestRateLimit(token, 30);

  const due = db
    .select({ id: schema.sections.id, title: schema.sections.title })
    .from(schema.sections)
    .where(and(eq(schema.sections.pageId, page.id), ne(schema.sections.status, "draft"), isNull(schema.sections.clientApprovedAt)))
    .all();
  if (due.length === 0) return { approved: 0 };
  const now = Math.floor(Date.now() / 1000);
  db.transaction((tx) => {
    for (const s of due) tx.update(schema.sections).set({ clientApprovedAt: now, clientApprovedBy: guest }).where(eq(schema.sections.id, s.id)).run();
  });
  for (const s of due) logActivity({ workspaceId: ws.id, actorId: null, verb: "approved", subjectType: "section", subjectId: s.id, subjectTitle: s.title, meta: { guest, clientApproved: true } });
  await notifyShareTeam(ws.id, "client_approved", `${guest} approved ${due.length === 1 ? due[0].title : `${due.length} sections`} on ${page.title}`, null, `/w/${ws.slug}/copy/${page.slug}`);
  revalidate(ws, page.slug);
  return { approved: due.length };
}
