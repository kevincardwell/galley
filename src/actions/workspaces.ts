"use server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { WORKSPACE_STATUSES } from "@/db/schema";
import { requireUser } from "@/lib/auth/current";
import { accessFor, assertAccess } from "@/lib/permissions";
import { newId, newToken } from "@/lib/ids";
import { slugify } from "@/lib/slug";
import { logActivity, logAudit } from "@/lib/activity";
import { storage } from "@/lib/storage";
import { copyStructure } from "@/lib/workspaces/template";
import { fetchFavicon } from "@/lib/favicon";

const wsInput = z.object({
  name: z.string().trim().min(1, "Give the workspace a name").max(80),
  url: z.string().trim().max(200).optional().transform((v) => (v ? (/^https?:\/\//.test(v) ? v : `https://${v}`) : null)),
  clientName: z.string().trim().max(80).optional().transform((v) => v || null),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  status: z.enum(WORKSPACE_STATUSES).optional(),
  templateId: z.string().trim().optional().transform((v) => v || null),
});

function uniqueSlug(base: string, exceptId?: string) {
  let slug = slugify(base);
  let i = 2;
  while (true) {
    const hit = db.select({ id: schema.workspaces.id }).from(schema.workspaces).where(eq(schema.workspaces.slug, slug)).get();
    if (!hit || hit.id === exceptId) return slug;
    slug = `${slugify(base)}-${i++}`;
  }
}

const DEFAULT_SECTIONS = ["Design", "Build", "Content", "Launch"];

export async function createWorkspace(form: FormData) {
  const user = await requireUser();
  const parsed = wsInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
  const { name, url, clientName, accent, templateId } = parsed.data;
  // Only copy from a project this person can actually see.
  const template = templateId && accessFor(user, templateId, "view") ? templateId : null;
  const id = newId();
  const slug = uniqueSlug(name);
  db.transaction((tx) => {
    tx.insert(schema.workspaces).values({ id, name, slug, url, clientName, accent: accent ?? "#2F6B4F", createdBy: user.id }).run();
    tx.insert(schema.memberships).values({ workspaceId: id, userId: user.id, role: "manager", addedBy: user.id }).run();
    if (template) {
      copyStructure(tx, template, id, user.id);
    } else {
      DEFAULT_SECTIONS.forEach((n, i) => tx.insert(schema.taskSections).values({ id: newId(), workspaceId: id, name: n, position: i }).run());
      tx.insert(schema.pages).values({ id: newId(), workspaceId: id, title: "Home", slug: "home", position: 0 }).run();
    }
  });
  logActivity({ workspaceId: id, actorId: user.id, verb: "created", subjectType: "workspace", subjectId: id, subjectTitle: name });
  if (url) fetchFavicon(id, url).catch(() => {});
  redirect(`/w/${slug}`);
}

export async function updateWorkspace(workspaceId: string, form: FormData) {
  const user = await requireUser();
  const { workspace } = assertAccess(user, workspaceId, "manage");
  const parsed = wsInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
  const { name, url, clientName, accent, status } = parsed.data;
  const slug = name !== workspace.name ? uniqueSlug(name, workspace.id) : workspace.slug;
  db.update(schema.workspaces)
    .set({ name, slug, url, clientName, accent: accent ?? workspace.accent, status: status ?? workspace.status })
    .where(eq(schema.workspaces.id, workspace.id))
    .run();
  logActivity({ workspaceId: workspace.id, actorId: user.id, verb: "updated", subjectType: "workspace", subjectId: workspace.id, subjectTitle: name });
  if (url && url !== workspace.url) fetchFavicon(workspace.id, url).catch(() => {});
  revalidatePath("/", "layout");
  if (slug !== workspace.slug) redirect(`/w/${slug}/settings`);
}

export async function setWorkspaceStatus(workspaceId: string, status: (typeof WORKSPACE_STATUSES)[number]) {
  const user = await requireUser();
  const { workspace } = assertAccess(user, workspaceId, "manage");
  db.update(schema.workspaces).set({ status, archivedAt: status === "archived" ? Math.floor(Date.now() / 1000) : null }).where(eq(schema.workspaces.id, workspace.id)).run();
  logActivity({ workspaceId: workspace.id, actorId: user.id, verb: status === "archived" ? "archived" : "updated", subjectType: "workspace", subjectId: workspace.id, subjectTitle: workspace.name, meta: { status } });
  revalidatePath("/", "layout");
}

export async function deleteWorkspace(workspaceId: string) {
  const user = await requireUser();
  const { workspace } = assertAccess(user, workspaceId, "manage");
  db.delete(schema.workspaces).where(eq(schema.workspaces.id, workspace.id)).run();
  await storage.removeWorkspace(workspace.id);
  logAudit({ actorId: user.id, action: "workspace.deleted", subjectType: "workspace", subjectId: workspace.id, meta: { name: workspace.name } });
  redirect("/");
}

/**
 * The calendar feed is a separate opt-in with its own token: a client share link shows copy and
 * files, while the feed would expose the whole run sheet and every task deadline.
 */
export async function toggleCalendarFeed(workspaceId: string, enable: boolean) {
  const user = await requireUser();
  const { workspace } = assertAccess(user, workspaceId, "manage");
  db.update(schema.workspaces).set({ calendarToken: enable ? newToken() : null }).where(eq(schema.workspaces.id, workspace.id)).run();
  logAudit({ actorId: user.id, action: enable ? "calendar_feed.enabled" : "calendar_feed.disabled", subjectType: "workspace", subjectId: workspace.id });
  revalidatePath(`/w/${workspace.slug}`, "layout");
}

export async function toggleShareLink(workspaceId: string, enable: boolean) {
  const user = await requireUser();
  const { workspace } = assertAccess(user, workspaceId, "manage");
  db.update(schema.workspaces).set({ shareToken: enable ? newToken() : null }).where(eq(schema.workspaces.id, workspace.id)).run();
  logAudit({ actorId: user.id, action: enable ? "share.enabled" : "share.disabled", subjectType: "workspace", subjectId: workspace.id });
  revalidatePath(`/w/${workspace.slug}`, "layout");
}

/** Lets (or stops letting) people with the share link comment on and approve sections. */
export async function setShareReview(workspaceId: string, enabled: boolean) {
  const user = await requireUser();
  const { workspace } = assertAccess(user, workspaceId, "manage");
  db.update(schema.workspaces).set({ shareReview: enabled }).where(eq(schema.workspaces.id, workspace.id)).run();
  logAudit({ actorId: user.id, action: enabled ? "share.review_enabled" : "share.review_disabled", subjectType: "workspace", subjectId: workspace.id });
  revalidatePath(`/w/${workspace.slug}`, "layout");
  if (workspace.shareToken) revalidatePath(`/share/${workspace.shareToken}`, "layout");
}
