"use server";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notify } from "@/lib/notify";
import { db, schema } from "@/db/client";
import { newId } from "@/lib/ids";
import { logActivity } from "@/lib/activity";

/**
 * Guest writes through the share link. There is no signed-in user here: the
 * token is the whole key, and the workspace must have client review switched on.
 */

const MAX_NAME = 60;
const MAX_BODY = 2000;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_WRITES = 30;

// token -> timestamps (ms) of recent writes. Process-local; fine for one container.
const writes = new Map<string, number[]>();

function rateLimit(token: string) {
  const now = Date.now();
  const recent = (writes.get(token) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_WRITES) throw new Error("Too many changes in a short time. Try again in a few minutes.");
  recent.push(now);
  writes.set(token, recent);
  if (writes.size > 500) for (const [k, v] of writes) if (!v.some((t) => now - t < WINDOW_MS)) writes.delete(k);
}

function cleanName(name: string): string {
  const n = (name ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_NAME);
  if (!n) throw new Error("Tell us your name first");
  return n;
}

function cleanBody(body: string): string {
  const b = (body ?? "").trim().slice(0, MAX_BODY);
  if (!b) throw new Error("Write something first");
  return b;
}

/** Workspace + section + page for a share token, or throws "Not found" without saying why. */
function guestContext(token: string, sectionId: string) {
  if (!token || !sectionId) throw new Error("Not found");
  const ws = db.select().from(schema.workspaces).where(eq(schema.workspaces.shareToken, token)).get();
  if (!ws || !ws.shareReview) throw new Error("Not found");
  const row = db
    .select({ section: schema.sections, pageSlug: schema.pages.slug, pageTitle: schema.pages.title })
    .from(schema.sections)
    .innerJoin(schema.pages, eq(schema.pages.id, schema.sections.pageId))
    .where(and(eq(schema.sections.id, sectionId), eq(schema.sections.workspaceId, ws.id)))
    .get();
  if (!row) throw new Error("Not found");
  return { ws, ...row };
}

/** One inbox row (and an email when SMTP is configured) per manager/editor of the workspace. */
async function notifyTeam(workspaceId: string, kind: "client_comment" | "client_approved", title: string, body: string | null, href: string) {
  const members = db
    .select({ userId: schema.memberships.userId })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.workspaceId, workspaceId), inArray(schema.memberships.role, ["manager", "editor"])))
    .all();
  await Promise.all(members.map((m) => notify({ userId: m.userId, workspaceId, kind, title, body, href, email: true })));
}

function revalidate(ws: { slug: string; shareToken: string | null }, pageSlug: string) {
  revalidatePath(`/share/${ws.shareToken}/${pageSlug}`);
  revalidatePath(`/w/${ws.slug}/copy/${pageSlug}`);
}

export async function guestComment(token: string, sectionId: string, name: string, body: string): Promise<{ id: string }> {
  const guest = cleanName(name);
  const text = cleanBody(body);
  const { ws, section, pageSlug, pageTitle } = guestContext(token, sectionId);
  rateLimit(token);
  const id = newId();
  db.insert(schema.comments).values({ id, workspaceId: ws.id, sectionId: section.id, body: text, authorId: null, guestName: guest }).run();
  logActivity({ workspaceId: ws.id, actorId: null, verb: "commented", subjectType: "section", subjectId: section.id, subjectTitle: section.title, meta: { guest } });
  await notifyTeam(ws.id, "client_comment", `${guest} commented on ${pageTitle} › ${section.title}`, text.length > 160 ? `${text.slice(0, 157)}…` : text, `/w/${ws.slug}/copy/${pageSlug}#s-${section.id}`);
  revalidate(ws, pageSlug);
  return { id };
}

export async function guestApprove(token: string, sectionId: string, name: string, approve: boolean): Promise<{ approvedAt: number | null }> {
  const guest = cleanName(name);
  const { ws, section, pageSlug, pageTitle } = guestContext(token, sectionId);
  rateLimit(token);
  const approvedAt = approve ? Math.floor(Date.now() / 1000) : null;
  db.update(schema.sections)
    .set({ clientApprovedAt: approvedAt, clientApprovedBy: approve ? guest : null })
    .where(eq(schema.sections.id, section.id))
    .run();
  logActivity({ workspaceId: ws.id, actorId: null, verb: approve ? "approved" : "updated", subjectType: "section", subjectId: section.id, subjectTitle: section.title, meta: { guest, clientApproved: approve } });
  if (approve) await notifyTeam(ws.id, "client_approved", `${guest} approved ${pageTitle} › ${section.title}`, null, `/w/${ws.slug}/copy/${pageSlug}#s-${section.id}`);
  revalidate(ws, pageSlug);
  return { approvedAt };
}
