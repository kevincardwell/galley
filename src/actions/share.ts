"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db/client";
import { newId } from "@/lib/ids";
import { logActivity } from "@/lib/activity";
import { cleanGuestName, guestRateLimit, shareWorkspace } from "@/lib/share/guard";
import { notifyShareTeam } from "@/lib/share/notify";

/**
 * Guest writes through the share link. There is no signed-in user here: the
 * token is the whole key, and the workspace must have client review switched on.
 */

const MAX_BODY = 2000;

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
  revalidatePath(`/share/${ws.shareToken}/${pageSlug}`);
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
