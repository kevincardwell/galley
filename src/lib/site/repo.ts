import "server-only";
import fsp from "node:fs/promises";
import path from "node:path";
import { SITES_DIR } from "@/db/client";
import type { Site, User } from "@/db/schema";
import { cleanRel, siteRoot } from "./files";
import { git, GitError, siteDir } from "./git";

export type Change = { file: string; kind: "modified" | "added" | "deleted" | "renamed"; from?: string };

/** Paths inside the repository, for the site-relative paths people see. */
const inRepo = (site: Site, rel: string) => path.posix.join(site.root || ".", rel);
const fromRepo = (site: Site, p: string) => (site.root ? path.posix.relative(site.root, p) : p);
const insideRoot = (site: Site, p: string) => !site.root || p === site.root || p.startsWith(site.root + "/");

async function remoteHas(dir: string, branch: string, token: string | null): Promise<boolean> {
  const out = await git(dir, ["ls-remote", "--heads", "origin", branch], { token, timeout: 30_000 });
  return out.trim().length > 0;
}

/**
 * Clones the repository and checks out the work branch: the one already on the remote if a
 * previous review is still open, otherwise a fresh one from the base branch.
 * Clones into a temporary folder first, so a failed clone leaves nothing behind.
 */
export async function cloneSite(site: Site): Promise<void> {
  await fsp.mkdir(SITES_DIR, { recursive: true });
  const dir = siteDir(site.workspaceId);
  const tmp = `${dir}.cloning-${Date.now()}`;
  try {
    await git(SITES_DIR, ["clone", "--no-tags", "--branch", site.baseBranch, "--", site.repoUrl, path.basename(tmp)], { token: site.token, timeout: 300_000 });
    const branch = (await remoteHas(tmp, site.workBranch, site.token)) ? `origin/${site.workBranch}` : `origin/${site.baseBranch}`;
    if (branch !== `origin/${site.baseBranch}`) await git(tmp, ["fetch", "origin", site.workBranch], { token: site.token });
    await git(tmp, ["checkout", "-B", site.workBranch, branch]);
    if (site.root && !(await fsp.stat(path.join(tmp, site.root)).catch(() => null))?.isDirectory()) {
      throw new GitError(`There is no folder called "${site.root}" in that repository`);
    }
    await fsp.rm(dir, { recursive: true, force: true });
    await fsp.rename(tmp, dir);
  } catch (err) {
    await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

/** Unsent changes inside the site folder. */
export async function changes(site: Site): Promise<Change[]> {
  const out = await git(siteDir(site.workspaceId), ["status", "--porcelain=v1", "-z", "-uall"]);
  const parts = out.split("\0");
  const list: Change[] = [];
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i];
    if (entry.length < 4) continue;
    const xy = entry.slice(0, 2);
    const p = entry.slice(3);
    let from: string | undefined;
    if (xy[0] === "R" || xy[0] === "C") from = parts[++i];
    if (!insideRoot(site, p)) continue;
    const kind: Change["kind"] = xy === "??" || xy.includes("A") ? "added" : xy.includes("D") ? "deleted" : from ? "renamed" : "modified";
    list.push({ file: fromRepo(site, p), kind, ...(from ? { from: fromRepo(site, from) } : {}) });
  }
  return list.sort((a, b) => a.file.localeCompare(b.file));
}

/** Every file in the site folder, for the editor's file list. */
export async function listFiles(site: Site): Promise<string[]> {
  const out = await git(siteDir(site.workspaceId), ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--deduplicate", "--", site.root || "."]);
  const files = out
    .split("\0")
    .filter(Boolean)
    .map((p) => fromRepo(site, p))
    .filter((p) => cleanRel(p) === p);
  // ls-files still lists files deleted from the working tree; the editor can't open those.
  const root = siteRoot(site);
  const present = await Promise.all(files.map((f) => fsp.lstat(path.join(root, f)).then(() => f, () => null)));
  return present.filter((f): f is string => !!f).sort();
}

/** A unified diff of one unsent change, ready to show. */
export async function fileDiff(site: Site, file: string): Promise<string> {
  const change = (await changes(site)).find((c) => c.file === file);
  if (!change) return "";
  const dir = siteDir(site.workspaceId);
  if (change.kind === "added" && !(await git(dir, ["ls-files", "--", inRepo(site, file)])).trim()) {
    const text = await fsp.readFile(path.join(siteRoot(site), file), "utf8").catch(() => "");
    if (text.includes("\0")) return "Binary file added";
    return text
      .split("\n")
      .map((l) => `+${l}`)
      .join("\n");
  }
  const out = await git(dir, ["diff", "--no-color", "--no-ext-diff", "--find-renames", "HEAD", "--", inRepo(site, file), ...(change.from ? [inRepo(site, change.from)] : [])]);
  const lines = out.split("\n");
  const first = lines.findIndex((l) => l.startsWith("@@"));
  return first === -1 ? "" : lines.slice(first).join("\n"); // drop the diff --git / index / --- / +++ header
}

/** Puts one file back as it was in the last commit (or removes it, if it is new). */
export async function revertFile(site: Site, file: string): Promise<void> {
  const change = (await changes(site)).find((c) => c.file === file);
  if (!change) return;
  const dir = siteDir(site.workspaceId);
  const tracked = (await git(dir, ["ls-files", "--", inRepo(site, file)])).trim().length > 0;
  if (tracked || change.kind === "deleted") await git(dir, ["checkout", "HEAD", "--", inRepo(site, file)]);
  else await fsp.rm(path.join(siteRoot(site), file), { force: true });
  if (change.from) await git(dir, ["checkout", "HEAD", "--", inRepo(site, change.from)]).catch(() => {});
}

/** Commits everything as the person who pressed the button, and pushes the work branch. Returns the new head. */
export async function commitAndPush(site: Site, user: Pick<User, "name" | "email" | "gitEmail">, message: string): Promise<string> {
  const dir = siteDir(site.workspaceId);
  await git(dir, ["add", "--all", "--", site.root || "."]);
  const staged = (await git(dir, ["diff", "--cached", "--name-only"])).trim();
  if (staged) {
    const email = user.gitEmail || user.email;
    await git(dir, ["commit", "--no-verify", "-m", message], {
      env: { GIT_AUTHOR_NAME: user.name, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: user.name, GIT_COMMITTER_EMAIL: email },
    });
  }
  const head = (await git(dir, ["rev-parse", "HEAD"])).trim();
  const base = (await git(dir, ["rev-parse", `origin/${site.baseBranch}`])).trim();
  if (head === base) throw new GitError("There is nothing to send yet");
  await git(dir, ["push", "--force-with-lease", "origin", `HEAD:refs/heads/${site.workBranch}`], { token: site.token, timeout: 120_000 });
  return head;
}

export type Sync = { behind: number; unsent: number };

/** How far the work branch is from the base branch on the remote, as of the last fetch. */
export async function syncState(site: Site): Promise<Sync> {
  const dir = siteDir(site.workspaceId);
  const count = async (range: string) => Number((await git(dir, ["rev-list", "--count", range]).catch(() => "0")).trim()) || 0;
  return { behind: await count(`HEAD..origin/${site.baseBranch}`), unsent: await count(`origin/${site.baseBranch}..HEAD`) };
}

export async function fetchRemote(site: Site): Promise<void> {
  await git(siteDir(site.workspaceId), ["fetch", "--prune", "origin"], { token: site.token, timeout: 120_000 });
}

/**
 * Brings the working copy up to date with the base branch.
 * - The review was merged or closed and nothing new was written since: start again from the base branch.
 * - Otherwise replay this branch on top of it, keeping unsaved edits; give up cleanly on a conflict.
 */
export async function updateFromBase(site: Site, reviewDone: boolean): Promise<"reset" | "rebased" | "current"> {
  const dir = siteDir(site.workspaceId);
  await fetchRemote(site);
  const { behind, unsent } = await syncState(site);
  const dirty = (await changes(site)).length > 0;
  const head = (await git(dir, ["rev-parse", "HEAD"])).trim();
  if (reviewDone && !dirty && (unsent === 0 || head === site.prHeadSha)) {
    await git(dir, ["checkout", "-B", site.workBranch, `origin/${site.baseBranch}`]);
    return "reset";
  }
  if (behind === 0) return "current";
  try {
    await git(dir, ["rebase", "--autostash", `origin/${site.baseBranch}`]);
    return "rebased";
  } catch {
    await git(dir, ["rebase", "--abort"]).catch(() => {});
    throw new GitError(`${site.baseBranch} and these changes both edited the same lines. Send these changes for review and settle it in the pull request.`);
  }
}
