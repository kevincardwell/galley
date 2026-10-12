"use server";
import fsp from "node:fs/promises";
import path from "node:path";
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import type { Site, User } from "@/db/schema";
import { requireUser } from "@/lib/auth/current";
import { assertAccess } from "@/lib/permissions";
import { logActivity, logAudit } from "@/lib/activity";
import { cleanRel, readEditable, siteRoot, writeEditable } from "@/lib/site/files";
import { siteDir, withRepoLock } from "@/lib/site/git";
import { buildState, deleteSecret, githubRepo, listSecrets, openReview, reviewState, setSecrets, type BuildState, type RepoSecret, type Review } from "@/lib/site/github";
import { applyTextEdit } from "@/lib/site/html";
import { connectSite as connect, editorsSince, getSite, previewPrefix, siteFromForm } from "@/lib/site";
import { changes, commitAndPush, fetchRemote, fileDiff, listFiles, revertFile, syncState, updateFromBase, type Change } from "@/lib/site/repo";

/** Every member edits the site; only managers connect it or hold its token. */
async function siteAccess(workspaceId: string, verb: "view" | "manage" = "view") {
  const user = await requireUser();
  const { workspace } = assertAccess(user, workspaceId, verb);
  const site = getSite(workspace.id);
  if (!site) throw new Error("This project has no site connected");
  return { user, workspace, site };
}

const sitePath = (slug: string) => `/w/${slug}/site`;
const now = () => Math.floor(Date.now() / 1000);

export async function connectSite(workspaceId: string, form: FormData) {
  const user = await requireUser();
  const { workspace } = assertAccess(user, workspaceId, "manage");
  if (getSite(workspace.id)) throw new Error("A site is already connected. Disconnect it first.");
  const input = siteFromForm(form);
  if (!input) throw new Error("Paste the repository's address");
  await withRepoLock(workspace.id, () => connect(workspace.id, input, user.id));
  logAudit({ actorId: user.id, action: "site.connected", subjectType: "workspace", subjectId: workspace.id, meta: { repo: input.repoUrl } });
  revalidatePath(sitePath(workspace.slug));
}

/** Token and site folder. A different repository or branch means disconnecting and connecting again. */
export async function updateSiteSettings(workspaceId: string, form: FormData) {
  const { user, workspace, site } = await siteAccess(workspaceId, "manage");
  const token = String(form.get("token") ?? "").trim();
  const root = cleanRel(String(form.get("root") ?? ""));
  if (root === null) throw new Error("That folder can't be used");
  if (root && !(await fsp.stat(path.join(siteDir(site.workspaceId), root)).catch(() => null))?.isDirectory()) throw new Error(`There is no folder called "${root}" in the repository`);
  db.update(schema.sites)
    .set({ root, ...(token ? { token } : {}) })
    .where(eq(schema.sites.workspaceId, workspace.id))
    .run();
  logAudit({ actorId: user.id, action: token ? "site.token_changed" : "site.updated", subjectType: "workspace", subjectId: workspace.id });
  revalidatePath(sitePath(workspace.slug));
}

export async function disconnectSite(workspaceId: string) {
  const { user, workspace } = await siteAccess(workspaceId, "manage");
  await withRepoLock(workspace.id, async () => {
    db.delete(schema.sites).where(eq(schema.sites.workspaceId, workspace.id)).run();
    await fsp.rm(siteDir(workspace.id), { recursive: true, force: true });
  });
  logAudit({ actorId: user.id, action: "site.disconnected", subjectType: "workspace", subjectId: workspace.id });
  revalidatePath(sitePath(workspace.slug));
}

/** One activity row per person per file per ten minutes, however often they press save. */
function noteEdit(site: Site, user: User, file: string) {
  const recent = db
    .select({ id: schema.activity.id })
    .from(schema.activity)
    .where(
      and(
        eq(schema.activity.workspaceId, site.workspaceId),
        eq(schema.activity.actorId, user.id),
        eq(schema.activity.subjectType, "file"),
        eq(schema.activity.subjectId, file),
        gt(schema.activity.createdAt, now() - 600),
      ),
    )
    .get();
  if (!recent) logActivity({ workspaceId: site.workspaceId, actorId: user.id, verb: "edited", subjectType: "file", subjectId: file, subjectTitle: file });
}

export async function siteFiles(workspaceId: string): Promise<string[]> {
  const { site } = await siteAccess(workspaceId);
  return listFiles(site);
}

export async function readSiteFile(workspaceId: string, file: string) {
  const { site } = await siteAccess(workspaceId);
  return readEditable(siteRoot(site), file);
}

export async function saveSiteFile(workspaceId: string, file: string, text: string, baseHash: string) {
  const { user, site } = await siteAccess(workspaceId);
  const rel = cleanRel(file);
  if (!rel) throw new Error("That file can't be saved here");
  const saved = await withRepoLock(site.workspaceId, () => writeEditable(siteRoot(site), rel, text, baseHash));
  noteEdit(site, user, rel);
  return saved;
}

const textEdit = z.object({
  file: z.string().max(500),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  hash: z.string().regex(/^[0-9a-f]{16}$/),
  html: z.string().max(100_000),
});

/** A click-to-edit from the preview: one block of text laid back into its page's source. */
export async function saveTextEdit(workspaceId: string, input: z.input<typeof textEdit>) {
  const { user, site } = await siteAccess(workspaceId);
  const parsed = textEdit.safeParse(input);
  if (!parsed.success) throw new Error("That edit could not be read");
  const { file, start, end, hash, html } = parsed.data;
  const rel = cleanRel(file);
  if (!rel || !/\.html?$/i.test(rel)) throw new Error("Only pages can be edited this way");
  await withRepoLock(site.workspaceId, async () => {
    const { text, hash: fileHash } = await readEditable(siteRoot(site), rel);
    const next = applyTextEdit(text, { start, end, hash, html, prefix: previewPrefix(site) });
    if (next !== text) await writeEditable(siteRoot(site), rel, next, fileHash);
  });
  noteEdit(site, user, rel);
}

export async function siteDiff(workspaceId: string, file: string): Promise<string> {
  const { site } = await siteAccess(workspaceId);
  return fileDiff(site, file);
}

export async function revertSiteFile(workspaceId: string, file: string) {
  const { user, workspace, site } = await siteAccess(workspaceId);
  await withRepoLock(site.workspaceId, () => revertFile(site, file));
  logActivity({ workspaceId: workspace.id, actorId: user.id, verb: "reverted", subjectType: "file", subjectId: file, subjectTitle: file });
}

export type SiteStatus = {
  changes: Change[];
  behind: number;
  unsent: number;
  review: Review | null;
  build: BuildState | null;
  github: boolean;
  hasToken: boolean;
  error: string | null;
};

/**
 * Everything the Site tab's toolbar shows. Talks to the remote at most once a minute unless asked to,
 * so opening the tab is not a network round trip every time.
 */
export async function siteStatus(workspaceId: string, opts: { fetch?: boolean } = {}): Promise<SiteStatus> {
  const { site } = await siteAccess(workspaceId);
  let error: string | null = null;
  const github = !!githubRepo(site.repoUrl);
  let review: Review | null = null;
  let build: BuildState | null = null;
  try {
    if (opts.fetch || !site.fetchedAt || now() - site.fetchedAt > 60) {
      await withRepoLock(site.workspaceId, () => fetchRemote(site));
      db.update(schema.sites).set({ fetchedAt: now() }).where(eq(schema.sites.workspaceId, site.workspaceId)).run();
    }
    if (github && site.token && site.prNumber) {
      review = await reviewState(site);
      if (review) build = await buildState(site, review.headSha);
    }
  } catch (err) {
    error = (err as Error).message;
  }
  const [list, sync] = await Promise.all([changes(site), syncState(site)]);
  return { changes: list, ...sync, review, build, github, hasToken: !!site.token, error };
}

/** Commits everything as the sender, credits everyone else who edited, pushes, and opens or updates the pull request. */
export async function sendForReview(workspaceId: string, message: string) {
  const { user, workspace, site } = await siteAccess(workspaceId);
  if (!site.token) throw new Error("A manager needs to add an access token in the site settings before changes can be sent");
  const subject = message.trim().slice(0, 200) || "Edits from Galley";
  const lastSent = db
    .select({ at: schema.activity.createdAt })
    .from(schema.activity)
    .where(and(eq(schema.activity.workspaceId, workspace.id), eq(schema.activity.verb, "sent for review")))
    .orderBy(desc(schema.activity.createdAt))
    .get();
  const others = editorsSince(workspace.id, lastSent?.at ?? 0).filter((id) => id !== user.id);
  const coauthors = others.length
    ? db.select().from(schema.users).where(inArray(schema.users.id, others)).all().map((u) => `Co-authored-by: ${u.name} <${u.gitEmail || u.email}>`)
    : [];
  const body = coauthors.length ? `${subject}\n\n${coauthors.join("\n")}` : subject;

  const result = await withRepoLock(site.workspaceId, async () => {
    const head = await commitAndPush(site, user, body);
    let review: Review | null = null;
    if (githubRepo(site.repoUrl)) {
      review = await openReview(site, subject, `Sent from Galley by ${user.name}.`);
    }
    db.update(schema.sites)
      .set({ prHeadSha: head, ...(review ? { prNumber: review.number } : {}) })
      .where(eq(schema.sites.workspaceId, site.workspaceId))
      .run();
    return { head, review };
  });
  logActivity({
    workspaceId: workspace.id,
    actorId: user.id,
    verb: "sent for review",
    subjectType: "site",
    subjectId: result.review ? String(result.review.number) : result.head,
    subjectTitle: subject,
    meta: { url: result.review?.url ?? null },
  });
  revalidatePath(sitePath(workspace.slug));
  return { url: result.review?.url ?? null, number: result.review?.number ?? null };
}

/** Brings in what was merged to the main branch, and starts a fresh review once the last one is done. */
export async function updateSiteFromRemote(workspaceId: string) {
  const { workspace, site } = await siteAccess(workspaceId);
  let reviewDone = false;
  if (githubRepo(site.repoUrl) && site.token && site.prNumber) {
    const review = await reviewState(site).catch(() => null);
    reviewDone = !!review && review.state !== "open";
  }
  const outcome = await withRepoLock(site.workspaceId, () => updateFromBase(site, reviewDone));
  if (outcome === "reset") db.update(schema.sites).set({ prNumber: null, prHeadSha: null, fetchedAt: now() }).where(eq(schema.sites.workspaceId, site.workspaceId)).run();
  revalidatePath(sitePath(workspace.slug));
  return outcome;
}

/** GitHub's rule for secret names; GITHUB_ is theirs. */
const SECRET_NAME = /^(?!GITHUB_)[A-Z_][A-Z0-9_]{0,99}$/;

/** The repository's deploy secrets, by name only. Managers only: they decide where the site goes. */
export async function deploySecrets(workspaceId: string): Promise<RepoSecret[]> {
  const { site } = await siteAccess(workspaceId, "manage");
  if (!githubRepo(site.repoUrl) || !site.token) return [];
  return listSecrets(site);
}

/**
 * Stores deploy details as encrypted Actions secrets in the repository, where its deploy workflow reads
 * them. The values pass through on their way to GitHub and are never written down here. An empty field
 * leaves that secret as it is.
 */
export async function saveDeploySecrets(workspaceId: string, values: Record<string, string>) {
  const { user, workspace, site } = await siteAccess(workspaceId, "manage");
  if (!githubRepo(site.repoUrl)) throw new Error("Deploy details can only be stored for a GitHub repository");
  if (!site.token) throw new Error("Add an access token first");
  const chosen: Record<string, string> = {};
  for (const [name, value] of Object.entries(values)) {
    if (!SECRET_NAME.test(name)) throw new Error(`"${name}" can't be a secret name: capital letters, digits and _ only`);
    if (typeof value !== "string" || value.length > 48_000) throw new Error(`${name} is too long`);
    if (value.trim()) chosen[name] = value;
  }
  if (!Object.keys(chosen).length) throw new Error("Nothing to save: every field was empty");
  await setSecrets(site, chosen);
  logAudit({ actorId: user.id, action: "site.secrets_set", subjectType: "workspace", subjectId: workspace.id, meta: { names: Object.keys(chosen) } });
}

export async function removeDeploySecret(workspaceId: string, name: string) {
  const { user, workspace, site } = await siteAccess(workspaceId, "manage");
  if (!SECRET_NAME.test(name)) throw new Error("Not found");
  await deleteSecret(site, name);
  logAudit({ actorId: user.id, action: "site.secret_removed", subjectType: "workspace", subjectId: workspace.id, meta: { name } });
}
