import "server-only";
import { UserError } from "@/lib/user-error";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db/client";
import type { Site } from "@/db/schema";
import { newToken } from "@/lib/ids";
import { cleanRel } from "./files";
import { cloneSite } from "./repo";

export const getSite = (workspaceId: string): Site | undefined => db.select().from(schema.sites).where(eq(schema.sites.workspaceId, workspaceId)).get();

/** Where the preview of a site is served: unguessable, because the frame cannot carry a session (see the route). */
export const previewPrefix = (site: Pick<Site, "workspaceId" | "previewToken">) => `/api/site/${site.workspaceId}/${site.previewToken}`;

// Branch names go into git argv: refuse anything that could read as an option or walk the ref namespace.
const branch = (fallback: string) =>
  z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => v || fallback)
    .refine((v) => /^[A-Za-z0-9._/-]+$/.test(v) && !v.startsWith("-") && !v.includes("..") && !v.endsWith("/") && !v.endsWith(".lock"), "That is not a usable branch name");

export const siteInput = z
  .object({
    repoUrl: z
      .string()
      .trim()
      .max(300)
      .refine(
        (v) => /^https:\/\/[A-Za-z0-9.-]+(:\d+)?\/\S+$/.test(v) || (process.env.GALLEY_TEST_GIT_FILE === "1" && /^file:\/\/\//.test(v)),
        "Use the repository's https:// address, without a password in it",
      ),
    token: z.string().trim().max(400).optional().transform((v) => v || null),
    baseBranch: branch("main"),
    workBranch: branch("galley"),
    root: z
      .string()
      .trim()
      .max(200)
      .optional()
      .transform((v) => cleanRel(v ?? ""))
      .refine((v): v is string => v !== null, "That folder can't be used"),
  })
  .refine((v) => v.baseBranch !== v.workBranch, { message: "Changes need a branch of their own, separate from the main one", path: ["workBranch"] });

export type SiteInput = z.infer<typeof siteInput>;

/** Pulls the site fields out of a form, or null when the form has no repository address. */
export function siteFromForm(form: FormData): SiteInput | null {
  const raw = Object.fromEntries(["repoUrl", "token", "baseBranch", "workBranch", "root"].map((k) => [k, String(form.get(k) ?? "")]));
  if (!raw.repoUrl.trim()) return null;
  const parsed = siteInput.safeParse(raw);
  if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message);
  return parsed.data;
}

export function newSite(workspaceId: string, input: SiteInput, userId: string): Site {
  return {
    workspaceId,
    repoUrl: input.repoUrl.replace(/\/+$/, ""),
    baseBranch: input.baseBranch,
    workBranch: input.workBranch,
    root: input.root,
    token: input.token,
    previewToken: newToken(),
    prNumber: null,
    prHeadSha: null,
    fetchedAt: Math.floor(Date.now() / 1000),
    createdBy: userId,
    createdAt: Math.floor(Date.now() / 1000),
  };
}

/**
 * Clones first and records the site only once that worked, so a wrong address or token leaves nothing
 * half made. "New project" does the same in two steps (clone, then one transaction for everything).
 */
export async function connectSite(workspaceId: string, input: SiteInput, userId: string): Promise<Site> {
  const site = newSite(workspaceId, input, userId);
  await cloneSite(site);
  db.insert(schema.sites).values(site).run();
  return site;
}

/** The people who edited files since the last send, for Co-authored-by lines on the commit. */
export function editorsSince(workspaceId: string, since: number): string[] {
  return db
    .selectDistinct({ actorId: schema.activity.actorId })
    .from(schema.activity)
    .where(and(eq(schema.activity.workspaceId, workspaceId), eq(schema.activity.subjectType, "file"), eq(schema.activity.verb, "edited"), gt(schema.activity.createdAt, since)))
    .all()
    .map((r) => r.actorId)
    .filter((id): id is string => !!id);
}
